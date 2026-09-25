// K3ライセンスキー入力のクライアント側オーケストレーション。
// 署名をオフライン検証→/activateで発動台数を確認→フェイルオープン判定→
// 永続化、の一連の流れ。束6のSETTINGS UIがこの関数を呼ぶ（この束では
// 呼び出し元ゼロ）。設計: docs/private/2026-09-02-device-sync-design.md §10。
import type { IDBPDatabase } from 'idb'
import { verifyLicenseKey } from './license-crypto'
import { saveLicense, type LicenseState } from './license-store'
import { getDeviceId } from '@/lib/sync/device-id'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

export type ActivateLicenseKeyResult =
  | { readonly status: 'unlocked'; readonly scope: readonly string[]; readonly verified: boolean }
  | { readonly status: 'invalid-key' }
  | { readonly status: 'unsupported' }
  | { readonly status: 'cap-exceeded' }

interface ActivateResponseBody {
  readonly ok: boolean
  readonly reason?: string
}

function isActivateResponseBody(v: unknown): v is ActivateResponseBody {
  return typeof v === 'object' && v !== null && typeof (v as { ok?: unknown }).ok === 'boolean'
}

const MAX_LABEL_LENGTH = 60

function detectBrowserName(ua: string): string {
  if (/Edg\//.test(ua)) return 'Edge'
  if (/OPR\//.test(ua) || /Opera/.test(ua)) return 'Opera'
  if (/Firefox\//.test(ua)) return 'Firefox'
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'Chrome'
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari'
  return 'Browser'
}

function detectOsName(ua: string): string {
  if (/Windows/.test(ua)) return 'Windows'
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS'
  if (/Mac OS X|Macintosh/.test(ua)) return 'macOS'
  if (/Android/.test(ua)) return 'Android'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Unknown'
}

/**
 * Short, non-identifying device label ("Chrome · Windows") sent to
 * `/activate` so SETTINGS' device list (design §3.4, later session) can show
 * something more useful than a bare device id. Browser + OS only — never
 * anything more specific (no version numbers, no hardware details).
 */
export function buildDeviceLabel(userAgent: string): string {
  const label = `${detectBrowserName(userAgent)} · ${detectOsName(userAgent)}`
  return label.length > MAX_LABEL_LENGTH ? label.slice(0, MAX_LABEL_LENGTH) : label
}

function currentUserAgent(): string {
  return typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string' ? navigator.userAgent : ''
}

interface PostActivateResult {
  readonly ok: boolean
  readonly reason?: 'cap-exceeded'
}

/**
 * Shared POST /activate call used by both activateLicenseKey (fresh key
 * entry) and registerDeviceIfMissingOrUnlabeled (SyncPanel's self-heal).
 * Never throws: any network failure, non-ok response, or malformed body
 * is reported as `{ok:false}` with no reason, exactly like
 * activateLicenseKey's own fail-open handling already treated them.
 */
async function postActivate(kid: string, deviceId: string, label: string): Promise<PostActivateResult> {
  try {
    const res = await fetch('/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kid, deviceId, label }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return { ok: false }
    const body: unknown = await res.json()
    if (!isActivateResponseBody(body)) return { ok: false }
    if (body.ok) return { ok: true }
    if (body.reason === 'cap-exceeded') return { ok: false, reason: 'cap-exceeded' }
    return { ok: false }
  } catch {
    return { ok: false }
  }
}

/**
 * キー文字列を発動する。
 *  1. オフラインで署名検証（不正なキーはここで即rejectし、ネットワークに触らない）
 *  2. `/activate` に device を報告して5台キャップを確認
 *  3. フェイルオープン境界（device-sync-design.md §10）:
 *     - 明示的な `{ok:false,reason:'cap-exceeded'}` だけが本物の拒否
 *     - それ以外（ネットワーク失敗・タイムアウト・不正レスポンス・
 *       `unknown-key`）は署名が本物である以上、解錠して `verified:false`
 *       で返す（サーバーが台数を数えられなかっただけ、という扱い）
 */
export async function activateLicenseKey(
  db: DbLike,
  keyString: string,
  publicKeyB64url?: string,
): Promise<ActivateLicenseKeyResult> {
  const verified = await verifyLicenseKey(keyString, publicKeyB64url)
  if (verified.status === 'unsupported') return { status: 'unsupported' }
  if (verified.status === 'invalid') return { status: 'invalid-key' }

  const deviceId = await getDeviceId(db)
  const { kid, scope } = verified.payload

  const activateResult = await postActivate(kid, deviceId, buildDeviceLabel(currentUserAgent()))
  if (activateResult.reason === 'cap-exceeded') return { status: 'cap-exceeded' }
  // 他の明示的reason（'unknown-key'等）・ネットワーク失敗はフェイルオープンへフォールスルー
  const confirmed = activateResult.ok

  // (Re-)activation always writes a fresh record — this is also how a device
  // that had `stopped` set (ended/device-removed) auto-clears it by putting a
  // new key in: db.put replaces the whole record, so any prior `stopped`
  // never survives. lastCheckedAt/lastConfirmedAt reset to now so
  // license-check.ts's next runSyncCycle doesn't immediately re-query.
  const now = Date.now()
  const state: LicenseState = { kid, deviceId, scope, validatedAt: now, lastCheckedAt: now, lastConfirmedAt: now }
  await saveLicense(db, state)
  return { status: 'unlocked', scope, verified: confirmed }
}

/** One activated device, as returned by /activate-status (SETTINGS device
 *  list, §3.4). `label` is the short browser/OS string from buildDeviceLabel
 *  (empty when unknown), `at` is the activation timestamp (0 = unknown, e.g.
 *  a legacy record migrated from the old string[] form). */
export interface DeviceInfo {
  readonly id: string
  readonly label: string
  readonly at: number
}

export interface DeviceCount {
  readonly count: number
  readonly max: number
  readonly devices: readonly DeviceInfo[]
}

interface DeviceCountResponseBody {
  readonly ok: boolean
  readonly count?: number
  readonly max?: number
  readonly devices?: unknown
}

function isDeviceCountResponseBody(v: unknown): v is DeviceCountResponseBody {
  return typeof v === 'object' && v !== null && typeof (v as { ok?: unknown }).ok === 'boolean'
}

function isDeviceInfo(v: unknown): v is DeviceInfo {
  if (typeof v !== 'object' || v === null) return false
  const d = v as { id?: unknown; label?: unknown; at?: unknown }
  return typeof d.id === 'string' && d.id.length > 0 && typeof d.label === 'string' && typeof d.at === 'number'
}

/** Validates the `devices` field of an /activate-status response. Malformed
 *  entries (wrong shape, not an array at all) are dropped rather than
 *  failing the whole lookup -- the count/max numbers are still useful even
 *  if the device list itself came back odd. */
function parseDevices(v: unknown): DeviceInfo[] {
  if (!Array.isArray(v)) return []
  return v.filter(isDeviceInfo)
}

/**
 * Read-only lookup of how many devices are currently activated against this
 * key ("X/5 devices used" + the expandable device list in SETTINGS). Never
 * throws and never returns a value that would look confidently wrong — any
 * network failure, non-ok response, or malformed body just returns `null`,
 * and the caller should simply not show the count rather than show a stale
 * or fabricated number.
 */
export async function fetchDeviceCount(kid: string): Promise<DeviceCount | null> {
  try {
    const res = await fetch(`/activate-status?kid=${encodeURIComponent(kid)}`, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    const body: unknown = await res.json()
    if (!isDeviceCountResponseBody(body) || !body.ok) return null
    if (typeof body.count !== 'number' || typeof body.max !== 'number') return null
    return { count: body.count, max: body.max, devices: parseDevices(body.devices) }
  } catch {
    return null
  }
}

/**
 * Best-effort self-heal POST for SETTINGS' SYNC device list
 * (components/board/SyncPanel.tsx): called once per panel mount, when its
 * own device list loads and finds THIS device either missing from `devices`
 * or present with an empty label (a legacy `act:<kid>` entry from before
 * labels existed, or one that otherwise never got one — root cause: an old
 * backup restore silently replacing this device's own
 * `license`/`sync-device-id` rows, see lib/storage/backup.ts's
 * DEVICE_LOCAL_SETTINGS_KEYS). SyncPanel decides WHETHER to call this
 * (missing-or-empty-label check); this just makes the call. Never throws
 * and never returns anything the caller could branch on differently for
 * `cap-exceeded` vs. any other failure -- the device already holds a
 * license either way, there is nothing more to do.
 */
export async function registerDeviceLabel(kid: string, deviceId: string): Promise<void> {
  await postActivate(kid, deviceId, buildDeviceLabel(currentUserAgent()))
}

interface ReleaseResponseBody {
  readonly ok: boolean
}

function isReleaseResponseBody(v: unknown): v is ReleaseResponseBody {
  return typeof v === 'object' && v !== null && typeof (v as { ok?: unknown }).ok === 'boolean'
}

/**
 * Removes `target` from `kid`'s activation list (SETTINGS device-list
 * "remove" button, POST /api/license/release). `deviceId` is this device's
 * own id -- the server uses it to confirm the caller is itself an activated
 * device on this key before honoring the removal. Never throws; returns
 * `true` only on an explicit `{ok:true}`. Any network failure, non-ok
 * response, malformed body, or explicit `{ok:false}` (e.g.
 * `not-authorized`) returns `false`, and the caller should leave the row in
 * place rather than assume it was removed.
 */
export async function releaseDevice(kid: string, deviceId: string, target: string): Promise<boolean> {
  try {
    const res = await fetch('/api/license/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kid, deviceId, target }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return false
    const body: unknown = await res.json()
    return isReleaseResponseBody(body) && body.ok
  } catch {
    return false
  }
}
