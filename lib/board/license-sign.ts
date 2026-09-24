// lib/board/license-sign.ts
// K3ライセンスキーの署名（Ed25519）。秘密鍵を扱うのはこの関数の呼び出し元
// （functions/claim.ts・functions/api/license/purchase.ts）だけで、鍵材料自体は
// ここを通過するのみで保存しない。
// 元は functions/claim.ts にあった signPayload をそのまま移設したもの（挙動不変）。
// 設計: docs/private/2026-07-01-k3-unlock-design.md §4.1 ／
// docs/private/2026-09-24-paddle-license-lifecycle-design.md §2.2（Paddle発行分もこの署名を再利用する）。
import {
  encodeLicensePayload, encodeLicenseKey, base64UrlToBytes, payloadSigningBytes, type LicensePayload,
} from './license-types'

/** payload を Ed25519 で署名し、ワイヤーフォーマットの鍵文字列を返す。 */
export async function signPayload(payload: LicensePayload, privateKeyB64url: string): Promise<string> {
  // new Uint8Array(...) re-wraps into a definite ArrayBuffer-backed array:
  // license-types.ts's helpers declare bare `Uint8Array` returns, which this
  // TS version widens to `Uint8Array<ArrayBufferLike>` — not assignable to
  // Web Crypto's `BufferSource`. Same fix as lib/private/crypto.ts and Task2's
  // license-crypto.ts (discovered during Task 2 implementation).
  const privateKey = await crypto.subtle.importKey('pkcs8', new Uint8Array(base64UrlToBytes(privateKeyB64url)), { name: 'Ed25519' }, false, ['sign'])
  const payloadB64url = encodeLicensePayload(payload)
  const signature = new Uint8Array(await crypto.subtle.sign('Ed25519', privateKey, new Uint8Array(payloadSigningBytes(payloadB64url))))
  return encodeLicenseKey(payloadB64url, signature)
}
