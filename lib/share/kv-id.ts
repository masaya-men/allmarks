// lib/share/kv-id.ts
const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/** Generate a 6-char base62 ID using cryptographic random. */
export function generateShareId(): string {
  const bytes = new Uint8Array(6)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    // Node fallback for SSR / tests without WebCrypto
    for (let i = 0; i < 6; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  let out = ''
  for (let i = 0; i < 6; i++) {
    out += ALPHABET[bytes[i] % 62]
  }
  return out
}

/** Validate a base62 6-char ID. */
export function isValidShareId(id: string): boolean {
  return /^[A-Za-z0-9]{6}$/.test(id)
}
