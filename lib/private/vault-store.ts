import type { IDBPDatabase } from 'idb'
import {
  PBKDF2_ITERATIONS, deriveKey, generateSalt, decryptJson, encryptJson,
  generateEcdhKeyPair, exportPublicKeyB64, wrapPrivateKey, unwrapPrivateKey,
  generateRecoveryKey, normalizeRecoveryKey,
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
  /** 復旧キー用のPBKDF2 salt。wrappedPrivateKeyByRecoveryKeyと対で存在する。
   *  無ければ「この端末は復旧キーを未設定」を意味する(既存レコードには
   *  存在しない — 後付け発行のための任意項目)。 */
  readonly recoverySalt?: string
  /** ECDH秘密鍵(pkcs8)の、復旧キー由来の鍵で暗号化したコピー。password用の
   *  wrappedPrivateKeyとは完全に独立した、もう一つの暗号化コピー。 */
  readonly wrappedPrivateKeyByRecoveryKey?: { readonly iv: string; readonly ciphertext: string }
  /** 復旧キー用のPBKDF2繰り返し回数。recoverySaltと対で存在する。
   *  record.iterations(パスワード用)とは別に、復旧ラップ自身が持つ —
   *  将来PBKDF2_ITERATIONSが変わってもこの値は既存の復旧キーに対して
   *  固定されたままなので、既発行の復旧キーが無言で全滅しない。 */
  readonly recoveryIterations?: number
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

/** session.wrappingKeyが実際にどちらの暗号化コピーを開けるかを気にせず、
 *  生のpkcs8バイト列を復元する。session.privateKey自体は
 *  extractable:falseでインポートされているため再書き出し不可能
 *  (unwrapPrivateKeyの4番目の引数)— 保存済みの暗号化コピーを再度復号する
 *  のが唯一の経路。まずパスワード用のコピー(既存の唯一の経路)を試し、
 *  それが失敗したら(= このsessionが復旧キー経由で解錠されたケース)
 *  復旧キー用のコピーにフォールバックする。 */
async function resolveOwnPkcs8(
  record: PrivateVaultRecord,
  session: NonNullable<PrivateVaultSession>,
): Promise<string> {
  try {
    const { pkcs8 } = await decryptJson<{ pkcs8: string }>(
      session.wrappingKey, record.wrappedPrivateKey.iv, record.wrappedPrivateKey.ciphertext,
    )
    return pkcs8
  } catch {
    if (!record.wrappedPrivateKeyByRecoveryKey) throw new Error('no recovery-key wrap to fall back to')
    const { pkcs8 } = await decryptJson<{ pkcs8: string }>(
      session.wrappingKey, record.wrappedPrivateKeyByRecoveryKey.iv, record.wrappedPrivateKeyByRecoveryKey.ciphertext,
    )
    return pkcs8
  }
}

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
    pkcs8 = await resolveOwnPkcs8(record, session)
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

/** すでに解錠済みのsessionから、新しい復旧キーを1つ生成して保存する。
 *  既存の復旧キーがあれば無条件に上書きする(=再発行)ため、「初めて
 *  設定する」と「前のキーを失くしたので作り直す」の両方をこの1つの
 *  関数でカバーする。返り値は表示用の復旧キー文字列そのもの — この関数の
 *  戻り値以外のどこにも平文の復旧キーは残らない。 */
export async function setUpRecoveryKey(
  db: DbLike,
  session: NonNullable<PrivateVaultSession>,
): Promise<string | null> {
  try {
    const record = await loadVaultRecord(db)
    if (!record) return null
    const pkcs8 = await resolveOwnPkcs8(record, session)
    const recoveryKey = generateRecoveryKey()
    const recoverySalt = generateSalt()
    const recoveryWrappingKey = await deriveKey(normalizeRecoveryKey(recoveryKey), recoverySalt, PBKDF2_ITERATIONS)
    const wrappedPrivateKeyByRecoveryKey = await encryptJson(recoveryWrappingKey, { pkcs8 })
    const newRecord: PrivateVaultRecord = {
      ...record, recoverySalt, wrappedPrivateKeyByRecoveryKey, recoveryIterations: PBKDF2_ITERATIONS, updatedAt: Date.now(),
    }
    await db.put('settings', newRecord)
    return recoveryKey
  } catch {
    return null
  }
}

/** 復旧キーでの解錠を試みる。unlockVaultのパスワード版と対になる —
 *  「復旧キーが無い/間違っている」は同じくnullを返す(例外を投げない)。 */
export async function unlockVaultWithRecoveryKey(
  db: DbLike,
  recoveryKeyInput: string,
): Promise<PrivateVaultSession> {
  const record = await loadVaultRecord(db)
  if (!record || !record.wrappedPrivateKeyByRecoveryKey || !record.recoverySalt) return null
  const wrappingKey = await deriveKey(normalizeRecoveryKey(recoveryKeyInput), record.recoverySalt, record.recoveryIterations ?? record.iterations)
  try {
    const privateKey = await unwrapPrivateKey(record.wrappedPrivateKeyByRecoveryKey, wrappingKey)
    return { tagId: record.tagId, privateKey, wrappingKey }
  } catch {
    return null
  }
}
