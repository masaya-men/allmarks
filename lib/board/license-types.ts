// K3ライセンスキーのワイヤーフォーマット。crypto呼び出しは無い純粋関数のみ
// （署名/検証はTask2のlicense-crypto.tsとfunctions/claim.tsがそれぞれ行う）。
// 設計: docs/private/2026-07-01-k3-unlock-design.md §3 ／
// docs/private/2026-09-02-device-sync-design.md §10（scope配列化はこの束での変更）。
import { z } from 'zod'

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string }

function issues(e: z.ZodError): string {
  return e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
}

/** 署名対象のペイロード。`scope` は将来の拡張（'all-paid' 等）を見越した配列。
 *  v1が発券するのは常に `['sync']` のみ（テーマ解錠は別束・別スコープ値）。 */
export const licensePayloadSchema = z.object({
  kid: z.string().min(1).max(64),
  scope: z.array(z.string().min(1).max(32)).min(1).max(8),
  v: z.literal(1),
  iat: z.number().int().positive(),
})
export type LicensePayload = z.infer<typeof licensePayloadSchema>

export function parseLicensePayload(input: unknown): ParseResult<LicensePayload> {
  const r = licensePayloadSchema.safeParse(input)
  return r.success ? { ok: true, value: r.data } : { ok: false, error: issues(r.error) }
}

// ── base64url（パディング無し）。Worker(workerd)・ブラウザどちらも atob/btoa を持つ ──

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** 実際にEd25519署名するバイト列＝base64urlペイロード文字列そのもののUTF-8バイト。
 *  JSONを再シリアライズしたものではなく「符号化済み文字列」自体を署名するので、
 *  署名側/検証側でJSONキー順等の正規化を気にする必要が無い。 */
export function payloadSigningBytes(payloadB64url: string): Uint8Array {
  return new TextEncoder().encode(payloadB64url)
}

export function encodeLicensePayload(payload: LicensePayload): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
}

/** `<base64url(payload JSON)>.<base64url(Ed25519 signature, 64 bytes)>`。
 *  v1のペイロードは小さいので全体で200文字前後＝テキスト欄に貼れる長さ。 */
export function encodeLicenseKey(payloadB64url: string, signature: Uint8Array): string {
  return `${payloadB64url}.${bytesToBase64Url(signature)}`
}

export interface DecodedLicenseKey {
  readonly payloadB64url: string
  readonly payload: LicensePayload
  readonly signature: Uint8Array
}

/** ワイヤーフォーマット＋JSONスキーマだけを検証する（署名検証はしない＝crypto不使用。
 *  署名検証はlicense-crypto.tsのverifyLicenseKeyの仕事）。壊れた入力は全て null。 */
export function decodeLicenseKey(keyString: string): DecodedLicenseKey | null {
  const parts = keyString.trim().split('.')
  if (parts.length !== 2) return null
  const [payloadB64url, sigB64url] = parts
  if (!payloadB64url || !sigB64url) return null

  let payloadJson: unknown
  try {
    payloadJson = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64url)))
  } catch {
    return null
  }
  const parsed = parseLicensePayload(payloadJson)
  if (!parsed.ok) return null

  let signature: Uint8Array
  try {
    signature = base64UrlToBytes(sigB64url)
  } catch {
    return null
  }
  if (signature.byteLength !== 64) return null // Ed25519の署名は常に64バイト

  return { payloadB64url, payload: parsed.value, signature }
}
