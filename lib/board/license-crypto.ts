// K3ライセンスキーのオフライン署名検証。ネットワークに一切触れない。
// 設計: docs/private/2026-07-01-k3-unlock-design.md §3。
import { decodeLicenseKey, payloadSigningBytes, base64UrlToBytes, type LicensePayload } from './license-types'
import { K3_PUBLIC_KEY } from '@/lib/constants'

export type VerifyLicenseKeyResult =
  | { readonly status: 'valid'; readonly payload: LicensePayload }
  | { readonly status: 'invalid' }
  | { readonly status: 'unsupported' }

/**
 * Ed25519署名をオフライン検証する。`publicKeyB64url` は既定で本物の公開鍵
 * （lib/constants.ts）を使うが、引数で差し替え可能（束2の申し送り＝
 * `vi.mock('@/lib/constants')` を避けるためのテスト用の注入経路）。
 * 'unsupported' = このブラウザのWeb CryptoにEd25519が無い（2025年より前の
 * エンジン）、または公開鍵が未設定（鍵ペア生成前の空文字）のいずれか。
 * 例外は投げない。
 */
export async function verifyLicenseKey(
  keyString: string,
  publicKeyB64url: string = K3_PUBLIC_KEY,
): Promise<VerifyLicenseKeyResult> {
  const decoded = decodeLicenseKey(keyString)
  if (!decoded) return { status: 'invalid' }

  let publicKey: CryptoKey
  try {
    // `new Uint8Array(...)` copies into a fresh ArrayBuffer-backed array:
    // license-types.ts's helpers declare bare `Uint8Array` returns, which
    // this TS version widens to `Uint8Array<ArrayBufferLike>` — not
    // assignable to Web Crypto's `BufferSource`. Same fix as lib/private/crypto.ts.
    publicKey = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(base64UrlToBytes(publicKeyB64url)),
      { name: 'Ed25519' },
      true,
      ['verify'],
    )
  } catch {
    return { status: 'unsupported' }
  }

  let verified: boolean
  try {
    verified = await crypto.subtle.verify(
      'Ed25519',
      publicKey,
      new Uint8Array(decoded.signature),
      new Uint8Array(payloadSigningBytes(decoded.payloadB64url)),
    )
  } catch {
    return { status: 'unsupported' }
  }
  return verified ? { status: 'valid', payload: decoded.payload } : { status: 'invalid' }
}
