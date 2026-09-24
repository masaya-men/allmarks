// K3/Paddleライセンスの定期確認ゲート。runSyncCycleの入口（lib/sync/engine.ts）
// から1か所だけ呼ばれる門番。設計: docs/private/2026-09-24-paddle-license-
// lifecycle-design.md §2.3, §3.2。サーバー契約:
//   GET /api/license/status?kid=&device=
//   -> {ok:true,active:true} | {ok:true,active:true,reason:'unknown'}
//    | {ok:true,active:false,reason:'ended'|'device-removed'}
//   非200・通信失敗・不正なbodyは全て「確認できなかった」として扱う。
import type { IDBPDatabase } from 'idb'
import { loadLicense, saveLicense } from './license-store'
import { isSyncUnlocked } from './theme-entitlement'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

/** 確認間隔（design §7: 規模上限に達したら伸ばせるよう定数1つに集約）。 */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000

/** 通信不能でも同期を止めずに待つ猶予（design §3.2）。 */
export const GRACE_MS = 7 * 24 * 60 * 60 * 1000

export type LicenseInactiveReason = 'no-license' | 'ended' | 'device-removed' | 'grace-expired'

export type LicenseCheckResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: LicenseInactiveReason }

interface LicenseStatusBody {
  readonly ok: true
  readonly active: boolean
  readonly reason?: string
}

function isLicenseStatusBody(v: unknown): v is LicenseStatusBody {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return o.ok === true && typeof o.active === 'boolean'
}

/**
 * Gatekeeper called once, at the top of `runSyncCycle` (design §3.2), before
 * any Drive call. Resolves legacy-record fallbacks so a `LicenseState` saved
 * before these fields existed behaves as "never checked" rather than
 * crashing or spuriously blocking: missing `lastCheckedAt` -> 0, missing
 * `lastConfirmedAt` -> `validatedAt` (the original activation already proved
 * a genuine signature, so it's a reasonable stand-in for "last confirmed").
 *
 * Never throws. An unexpected error here (e.g. an IndexedDB failure reading
 * or writing the license record) is treated as `{allowed:true}` — a storage
 * hiccup must not brick sync; the next cycle gets another chance to check.
 */
export async function checkLicenseForSync(
  db: DbLike,
  now: number = Date.now(),
  fetchImpl: typeof fetch = fetch,
): Promise<LicenseCheckResult> {
  try {
    const state = await loadLicense(db)
    if (!state || !isSyncUnlocked(state)) return { allowed: false, reason: 'no-license' }
    if (state.stopped) return { allowed: false, reason: state.stopped }

    const lastCheckedAt = state.lastCheckedAt ?? 0
    const lastConfirmedAt = state.lastConfirmedAt ?? state.validatedAt

    if (now - lastCheckedAt < CHECK_INTERVAL_MS) {
      if (now - lastConfirmedAt > GRACE_MS) return { allowed: false, reason: 'grace-expired' }
      return { allowed: true }
    }

    const url = `/api/license/status?kid=${encodeURIComponent(state.kid)}&device=${encodeURIComponent(state.deviceId)}`
    let body: unknown = null
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) })
      if (res.ok) body = await res.json()
    } catch {
      body = null // network failure / timeout — folds into "could not confirm" below
    }

    if (isLicenseStatusBody(body) && body.active) {
      await saveLicense(db, { ...state, lastCheckedAt: now, lastConfirmedAt: now })
      return { allowed: true }
    }
    if (isLicenseStatusBody(body) && !body.active && (body.reason === 'ended' || body.reason === 'device-removed')) {
      await saveLicense(db, { ...state, stopped: body.reason, lastCheckedAt: now })
      return { allowed: false, reason: body.reason }
    }

    // Could not confirm (network error, non-200, or a body that isn't one of
    // the two documented shapes): keep syncing on the existing confirmation
    // until the grace period runs out, so an outage doesn't look identical
    // to a real cancellation. Deliberately does NOT set `stopped` here — the
    // next successful check auto-recovers with no re-activation needed.
    await saveLicense(db, { ...state, lastCheckedAt: now })
    if (now - lastConfirmedAt > GRACE_MS) return { allowed: false, reason: 'grace-expired' }
    return { allowed: true }
  } catch {
    return { allowed: true }
  }
}
