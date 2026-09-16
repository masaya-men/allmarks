import type { IDBPDatabase } from 'idb'
import {
  PBKDF2_ITERATIONS, deriveKey, generateSalt, decryptJson, encryptJson,
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
  /** パスワード変更のたびに現在時刻を打つ(初回作成時は無し=undefined)。
   *  同期マージのLWW比較に使う(lib/sync/merge.ts mergeVault)。 */
  readonly updatedAt?: number
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
): Promise<NonNullable<PrivateVaultSession>> {
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
  return { tagId, privateKey, wrappingKey }
}

/** Attempts to unlock with `password`. Returns null (never throws) when
 *  there's no vault yet OR the password is wrong — callers show the same
 *  "wrong password" message either way. */
export async function unlockVault(db: DbLike, password: string): Promise<PrivateVaultSession> {
  const record = await loadVaultRecord(db)
  if (!record) return null
  const wrappingKey = await deriveKey(password, record.salt, record.iterations)
  try {
    const privateKey = await unwrapPrivateKey(record.wrappedPrivateKey, wrappingKey)
    return { tagId: record.tagId, privateKey, wrappingKey }
  } catch {
    return null
  }
}

export type ChangeVaultPasswordResult =
  | { readonly ok: true; readonly session: NonNullable<PrivateVaultSession> }
  | { readonly ok: false; readonly session?: undefined }

/**
 * Changes the vault's password WITHOUT requiring the old one — the caller
 * must already hold a valid, unlocked `session` (its `wrappingKey` proves
 * access; that's the whole point of this feature: an already-unlocked
 * device can reset the password for every other synced device too). Only
 * the password-derived wrapping changes; the ECDH key pair itself (and
 * therefore every already-encrypted Private bookmark) is untouched.
 *
 * Decrypts the CURRENTLY stored wrapped blob with `session.wrappingKey`
 * (not by re-deriving from a freshly-typed password) to get the raw pkcs8
 * bytes, then re-wraps them under a freshly-derived key from `newPassword`
 * (with a new random salt). Stamps `updatedAt` so lib/sync/merge.ts's
 * mergeVault can resolve this via LWW instead of treating it as a
 * conflict with another device's copy of the same vault.
 */
export async function changeVaultPassword(
  db: DbLike,
  session: NonNullable<PrivateVaultSession>,
  newPassword: string,
  newHint: string | undefined,
): Promise<ChangeVaultPasswordResult> {
  const record = await loadVaultRecord(db)
  if (!record) return { ok: false }

  let pkcs8: string
  try {
    const decrypted = await decryptJson<{ pkcs8: string }>(
      session.wrappingKey, record.wrappedPrivateKey.iv, record.wrappedPrivateKey.ciphertext,
    )
    pkcs8 = decrypted.pkcs8
  } catch {
    return { ok: false }
  }

  const newSalt = generateSalt()
  const newWrappingKey = await deriveKey(newPassword, newSalt, PBKDF2_ITERATIONS)
  const newWrapped = await encryptJson(newWrappingKey, { pkcs8 })

  const newRecord: PrivateVaultRecord = {
    ...record,
    salt: newSalt,
    iterations: PBKDF2_ITERATIONS,
    wrappedPrivateKey: newWrapped,
    updatedAt: Date.now(),
    hint: newHint,
  }
  await db.put('settings', newRecord)

  return { ok: true, session: { tagId: record.tagId, privateKey: session.privateKey, wrappingKey: newWrappingKey } }
}

/** Deletes the local vault record entirely. Called only after every one of
 *  its bookmarks has already been re-encrypted under a different vault's
 *  public key and retagged away from this vault's tag (see
 *  lib/private/vault-conflict.ts's mergeIntoOtherVault) — by the time this
 *  runs, nothing local still depends on this record. */
export async function retireVault(db: DbLike): Promise<void> {
  await db.delete('settings', VAULT_KEY)
}
