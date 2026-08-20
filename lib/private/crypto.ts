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

function base64ToBytes(b64: string): Uint8Array {
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
