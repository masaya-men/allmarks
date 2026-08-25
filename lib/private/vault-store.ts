import type { IDBPDatabase } from 'idb'
import {
  PBKDF2_ITERATIONS, deriveKey, generateSalt,
  generateEcdhKeyPair, exportPublicKeyB64, wrapPrivateKey, unwrapPrivateKey,
} from './crypto'
import type { PrivateVaultSession } from './vault-session'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

const VAULT_KEY = 'private-vault'

export type PrivateVaultRecord = {
  readonly key: 'private-vault'
  readonly tagId: string
  readonly salt: string
  readonly iterations: number
  /** ECDH public key (raw/spki, base64) — not secret, safe in plaintext.
   *  Lets any context encrypt (tag Private) without the password. */
  readonly publicKey: string
  /** ECDH private key (pkcs8, base64), encrypted under the password-derived
   *  key. Unwrapping this doubles as the "is this the right password?"
   *  check — no separate check-blob needed. */
  readonly wrappedPrivateKey: { readonly iv: string; readonly ciphertext: string }
  readonly hint?: string
}

export async function loadVaultRecord(db: DbLike): Promise<PrivateVaultRecord | null> {
  const record = (await db.get('settings', VAULT_KEY)) as PrivateVaultRecord | undefined
  return record ?? null
}

/** First-time setup: derives a wrapping key from `password`, generates a
 *  fresh ECDH key pair (public half stored in plaintext; private half
 *  wrapped under the password-derived key), stores the vault record, and
 *  returns an already-unlocked session. Overwrites any existing vault
 *  record — callers must ensure this is only reachable when no vault
 *  exists yet. */
export async function createVault(
  db: DbLike,
  tagId: string,
  password: string,
  hint?: string,
): Promise<PrivateVaultSession> {
  const salt = generateSalt()
  const wrappingKey = await deriveKey(password, salt, PBKDF2_ITERATIONS)
  const keyPair = await generateEcdhKeyPair()
  const publicKey = await exportPublicKeyB64(keyPair.publicKey)
  const wrappedPrivateKey = await wrapPrivateKey(keyPair.privateKey, wrappingKey)
  const record: PrivateVaultRecord = {
    key: VAULT_KEY,
    tagId,
    salt,
    iterations: PBKDF2_ITERATIONS,
    publicKey,
    wrappedPrivateKey,
    ...(hint ? { hint } : {}),
  }
  await db.put('settings', record)
  // Re-import from the just-wrapped blob (rather than reusing keyPair.privateKey
  // directly) so the session key is the same non-extractable shape unlockVault
  // produces, and this doubles as a sanity check that wrapping round-trips.
  const privateKey = await unwrapPrivateKey(wrappedPrivateKey, wrappingKey)
  return { tagId, privateKey }
}

/** Attempts to unlock with `password`. Returns null (never throws) when
 *  there's no vault yet OR the password is wrong — callers show the same
 *  "wrong password" message either way. */
export async function unlockVault(db: DbLike, password: string): Promise<PrivateVaultSession | null> {
  const record = await loadVaultRecord(db)
  if (!record) return null
  const wrappingKey = await deriveKey(password, record.salt, record.iterations)
  try {
    const privateKey = await unwrapPrivateKey(record.wrappedPrivateKey, wrappingKey)
    return { tagId: record.tagId, privateKey }
  } catch {
    return null
  }
}
