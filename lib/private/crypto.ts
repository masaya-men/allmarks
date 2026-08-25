// Web Crypto only (crypto.subtle) — no third-party crypto library. PBKDF2 for
// password -> key, AES-256-GCM for authenticated encryption (the GCM auth tag
// IS the "is this the right key" check — a wrong key/tampered ciphertext
// throws from subtle.decrypt rather than silently returning garbage).

/** OWASP Password Storage Cheat Sheet (2023) PBKDF2-SHA256 recommendation. */
export const PBKDF2_ITERATIONS = 600_000

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

// Explicit <ArrayBuffer> (not the bare `Uint8Array` alias, which TS 5.7+
// defaults to the wider `Uint8Array<ArrayBufferLike>`): callers pass this
// straight into Web Crypto params (BufferSource), which require the
// ArrayBuffer-backed variant specifically. `new Uint8Array(n)` already
// constructs one; this only tightens the type annotation to match.
function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** 16 random bytes, base64-encoded — pass to deriveKey as the PBKDF2 salt. */
export function generateSalt(): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(16)))
}

/** Password -> non-extractable AES-256-GCM CryptoKey via PBKDF2-SHA256. The
 *  key is marked non-extractable so it can never be read back out of
 *  crypto.subtle once derived (defense in depth beyond "we just don't call
 *  the export API"). */
export async function deriveKey(
  password: string,
  saltB64: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: base64ToBytes(saltB64), iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** JSON-serializes `data`, encrypts with AES-GCM under a fresh random IV
 *  (never reuse an IV with the same key). Returns base64 iv + ciphertext
 *  (ciphertext includes the GCM auth tag). */
export async function encryptJson(key: CryptoKey, data: unknown): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = new TextEncoder().encode(JSON.stringify(data))
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(cipherBuf)) }
}

/** Inverse of encryptJson. Throws (DOMException) if `key` is wrong or the
 *  ciphertext was tampered with — callers must catch and treat as "wrong
 *  password", never let this crash the caller. */
export async function decryptJson<T>(key: CryptoKey, iv: string, ciphertext: string): Promise<T> {
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(iv) },
    key,
    base64ToBytes(ciphertext),
  )
  return JSON.parse(new TextDecoder().decode(plainBuf)) as T
}

/** ECDH (P-256) key pair for the vault's public/private split: the public
 *  half is safe to store in plaintext (it's not secret) and lets ANY
 *  context encrypt (tag something Private) without the password. Only the
 *  matching private half (wrapped elsewhere under the password-derived
 *  key) can decrypt. */
export async function generateEcdhKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits'])
}

export async function exportPublicKeyB64(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('spki', key)
  return bytesToBase64(new Uint8Array(raw))
}

export async function importPublicKey(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('spki', base64ToBytes(b64), { name: 'ECDH', namedCurve: 'P-256' }, true, [])
}

/** Wraps (encrypts) a private key with `wrappingKey` (the PBKDF2-derived
 *  password key) for storage. Reuses encryptJson rather than adding new
 *  low-level byte-encryption code. */
export async function wrapPrivateKey(
  key: CryptoKey,
  wrappingKey: CryptoKey,
): Promise<{ iv: string; ciphertext: string }> {
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', key)
  return encryptJson(wrappingKey, { pkcs8: bytesToBase64(new Uint8Array(pkcs8)) })
}

/** Inverse of wrapPrivateKey. Throws (DOMException) if `wrappingKey` is
 *  wrong — same contract as decryptJson, and this doubles as the vault's
 *  password-correctness check (no separate check-blob needed). Imports the
 *  recovered key as non-extractable. */
export async function unwrapPrivateKey(
  wrapped: { iv: string; ciphertext: string },
  wrappingKey: CryptoKey,
): Promise<CryptoKey> {
  const { pkcs8 } = await decryptJson<{ pkcs8: string }>(wrappingKey, wrapped.iv, wrapped.ciphertext)
  return crypto.subtle.importKey(
    'pkcs8',
    base64ToBytes(pkcs8),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey', 'deriveBits'],
  )
}

/** ECDH shared secret -> HKDF-SHA256 -> AES-256-GCM key. Shared by
 *  encryptWithPublicKey/decryptWithPrivateKey so both sides derive the
 *  identical key (ECDH is symmetric: derive(A_priv, B_pub) ==
 *  derive(B_priv, A_pub)). No HKDF salt (zero-length — the shared secret is
 *  already unique per call via the ephemeral key, so no extra randomness is
 *  needed); `info` fixes the derivation to this one purpose. */
async function deriveAesKeyFromEcdh(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  const sharedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256)
  const hkdfKey = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode('allmarks-private-v1'),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Encrypts `data` under `publicKey` — usable from ANY context that can
 *  read the (non-secret) public key, no password/session required. Each
 *  call generates a fresh disposable (ephemeral) key pair; only its public
 *  half is included in the result (safe) so decryptWithPrivateKey can
 *  reconstruct the same AES key. */
export async function encryptWithPublicKey(
  publicKey: CryptoKey,
  data: unknown,
): Promise<{ ephemeralPublicKey: string; iv: string; ciphertext: string }> {
  const ephemeral = await generateEcdhKeyPair()
  const aesKey = await deriveAesKeyFromEcdh(ephemeral.privateKey, publicKey)
  const { iv, ciphertext } = await encryptJson(aesKey, data)
  const ephemeralPublicKey = await exportPublicKeyB64(ephemeral.publicKey)
  return { ephemeralPublicKey, iv, ciphertext }
}

/** Inverse of encryptWithPublicKey. Requires the vault's own (unwrapped,
 *  password-gated) static private key. */
export async function decryptWithPrivateKey<T>(
  privateKey: CryptoKey,
  envelope: { ephemeralPublicKey: string; iv: string; ciphertext: string },
): Promise<T> {
  const ephemeralPublicKey = await importPublicKey(envelope.ephemeralPublicKey)
  const aesKey = await deriveAesKeyFromEcdh(privateKey, ephemeralPublicKey)
  return decryptJson<T>(aesKey, envelope.iv, envelope.ciphertext)
}
