// lib/sync/file-crypto.ts
// Encryption of the sync data files on Google Drive. The key is derived from the license `kid`
// (identical on every device of one user), so all of a user's devices can read each other's files
// with no extra setup. Envelope = MAGIC + keyHint(8) + iv(12) + AES-GCM(gzip bytes), AAD = file name.
// Deliberately separate from lib/private/crypto.ts (the Private vault's password-based crypto).

export const SEAL_MAGIC: Uint8Array = new TextEncoder().encode('AMSE1')
const KEY_HINT_LEN = 8
const IV_LEN = 12
const HEADER_LEN = SEAL_MAGIC.length + KEY_HINT_LEN + IV_LEN
const TAG_LEN = 16

/** The file was sealed with a different license's key (different `kid`). */
export class SyncKeyMismatchError extends Error {
  constructor(fileName: string) {
    super(`${fileName} was encrypted with a different license`)
    this.name = 'SyncKeyMismatchError'
  }
}

/** A sealed file could not be opened (tampered, truncated, or swapped with another file). */
export class SyncSealOpenError extends Error {
  constructor(fileName: string, detail: string) {
    super(`${fileName} could not be decrypted: ${detail}`)
    this.name = 'SyncSealOpenError'
  }
}

/** What the engine needs to seal/open files for one cycle. */
export interface SyncCrypto {
  readonly key: CryptoKey
  readonly keyHint: Uint8Array
}

const enc = new TextEncoder()
const keyCache = new Map<string, Promise<CryptoKey>>()

function bs(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource
}

export function deriveSyncFileKey(kid: string): Promise<CryptoKey> {
  const cached = keyCache.get(kid)
  if (cached) return cached
  const p = (async (): Promise<CryptoKey> => {
    const ikm = await crypto.subtle.importKey('raw', bs(enc.encode(kid)), 'HKDF', false, ['deriveKey'])
    return crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: bs(enc.encode('allmarks-sync-file-v1')), info: bs(enc.encode('aes-gcm-256')) },
      ikm,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    )
  })()
  keyCache.set(kid, p)
  p.catch(() => keyCache.delete(kid))
  return p
}

/** First 8 bytes of SHA-256(kid): lets a reader tell "other license" from "corrupt". */
export async function deriveSyncKeyHint(kid: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', bs(enc.encode(kid)))
  return new Uint8Array(digest).slice(0, KEY_HINT_LEN)
}

/** Derives the per-cycle crypto context from a license kid. */
export async function createSyncCrypto(kid: string): Promise<SyncCrypto> {
  const [key, keyHint] = await Promise.all([deriveSyncFileKey(kid), deriveSyncKeyHint(kid)])
  return { key, keyHint }
}

export function isSealed(bytes: Uint8Array): boolean {
  if (bytes.byteLength < SEAL_MAGIC.length) return false
  for (let i = 0; i < SEAL_MAGIC.length; i++) if (bytes[i] !== SEAL_MAGIC[i]) return false
  return true
}

export async function sealSyncFile(
  key: CryptoKey, keyHint: Uint8Array, name: string, gzBytes: Uint8Array,
): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN))
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: bs(iv), additionalData: bs(enc.encode(name)) }, key, bs(gzBytes),
  ))
  const out = new Uint8Array(HEADER_LEN + ct.byteLength)
  out.set(SEAL_MAGIC, 0)
  out.set(keyHint, SEAL_MAGIC.length)
  out.set(iv, SEAL_MAGIC.length + KEY_HINT_LEN)
  out.set(ct, HEADER_LEN)
  return out
}

export async function openSyncFile(
  key: CryptoKey, keyHint: Uint8Array, name: string, bytes: Uint8Array,
): Promise<Uint8Array> {
  if (!isSealed(bytes) || bytes.byteLength < HEADER_LEN + TAG_LEN) throw new SyncSealOpenError(name, 'truncated envelope')
  const hint = bytes.subarray(SEAL_MAGIC.length, SEAL_MAGIC.length + KEY_HINT_LEN)
  for (let i = 0; i < KEY_HINT_LEN; i++) if (hint[i] !== keyHint[i]) throw new SyncKeyMismatchError(name)
  const iv = bytes.slice(SEAL_MAGIC.length + KEY_HINT_LEN, HEADER_LEN)
  try {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bs(iv), additionalData: bs(enc.encode(name)) }, key, bs(bytes.slice(HEADER_LEN)),
    )
    return new Uint8Array(pt)
  } catch {
    throw new SyncSealOpenError(name, 'authentication failed')
  }
}
