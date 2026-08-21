import type { IDBPDatabase } from 'idb'
import { PBKDF2_ITERATIONS, deriveKey, encryptJson, decryptJson, generateSalt } from './crypto'
import type { PrivateVaultSession } from './vault-session'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

const VAULT_KEY = 'private-vault'
// Known plaintext used purely to verify a candidate password: if it decrypts
// (GCM auth passes), the password is right. Not secret itself.
const CHECK_PLAINTEXT = { ok: true } as const

export type PrivateVaultRecord = {
  readonly key: 'private-vault'
  readonly tagId: string
  readonly salt: string
  readonly iterations: number
  readonly checkIv: string
  readonly checkCiphertext: string
  readonly hint?: string
}

export async function loadVaultRecord(db: DbLike): Promise<PrivateVaultRecord | null> {
  const record = (await db.get('settings', VAULT_KEY)) as PrivateVaultRecord | undefined
  return record ?? null
}

/** First-time setup: derives a key from `password`, stores the vault record
 *  (salt/iterations/check-blob/hint — never the password itself), and
 *  returns an already-unlocked session for the caller to hand to
 *  setPrivateVaultSession. Overwrites any existing vault record — callers
 *  must ensure this is only reachable when no vault exists yet (Task 13). */
export async function createVault(
  db: DbLike,
  tagId: string,
  password: string,
  hint?: string,
): Promise<PrivateVaultSession> {
  const salt = generateSalt()
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS)
  const { iv: checkIv, ciphertext: checkCiphertext } = await encryptJson(key, CHECK_PLAINTEXT)
  const record: PrivateVaultRecord = {
    key: VAULT_KEY,
    tagId,
    salt,
    iterations: PBKDF2_ITERATIONS,
    checkIv,
    checkCiphertext,
    ...(hint ? { hint } : {}),
  }
  await db.put('settings', record)
  return { tagId, key }
}

/** Attempts to unlock with `password`. Returns null (never throws) when
 *  there's no vault yet OR the password is wrong — callers show the same
 *  "wrong password" message either way (no vault-not-found leak needed since
 *  the SETTINGS entry point already knows whether a vault exists). */
export async function unlockVault(db: DbLike, password: string): Promise<PrivateVaultSession | null> {
  const record = await loadVaultRecord(db)
  if (!record) return null
  const key = await deriveKey(password, record.salt, record.iterations)
  try {
    await decryptJson(key, record.checkIv, record.checkCiphertext)
  } catch {
    return null
  }
  return { tagId: record.tagId, key }
}
