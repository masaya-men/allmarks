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

  let confirmed = false
  try {
    const res = await fetch('/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kid, deviceId }),
    })
    if (res.ok) {
      const body: unknown = await res.json()
      if (isActivateResponseBody(body)) {
        if (body.ok) {
          confirmed = true
        } else if (body.reason === 'cap-exceeded') {
          return { status: 'cap-exceeded' }
        }
        // 他の明示的reason（'unknown-key'等）はフェイルオープンへフォールスルー
      }
    }
  } catch {
    // ネットワーク失敗 — フェイルオープンへフォールスルー
  }

  const state: LicenseState = { kid, deviceId, scope, validatedAt: Date.now() }
  await saveLicense(db, state)
  return { status: 'unlocked', scope, verified: confirmed }
}
