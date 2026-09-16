// lib/private/vault-conflict.ts
// Resolves the rare case where two devices each independently created their
// own Private vault before ever connecting device sync — two genuinely
// different ECDH key pairs, which cannot be merged by the normal sync merge
// (lib/sync/merge.ts's mergeVault already documents this: it treats
// differing-publicKey vaults as a real conflict, and lib/sync/engine.ts's
// runSyncCycle skips syncing vault.json entirely while that conflict stands).
//
// Design (agreed with the user 2026-09-16): a *deterministic* tie-break
// (reusing lib/sync/merge.ts's own pickDeterministic — the exact rule
// mergeVault already falls back to for this scenario) decides which of the
// two vaults is "the target" WITHOUT asking the user to choose. The losing
// device ("the source") re-encrypts its own already-decryptable Private
// bookmarks under the target's PUBLIC key (needs only its own existing
// password — see mergeIntoOtherVault) and retires its own vault + tag. The
// target device never needs to do anything password-gated at all: engine.ts
// (Task 6) auto-publishes its vault record to Drive using only public data.
// Nobody ever types a password meant for a different device.
import type { IDBPDatabase } from 'idb'
import { pickDeterministic } from '@/lib/sync/merge'
import { decryptWithPrivateKey, encryptWithPublicKey, importPublicKey } from './crypto'
import { retireVault, type PrivateVaultRecord } from './vault-store'
import { deleteTagCascade } from '@/lib/storage/tags'
import { getBookmark, touchBookmark } from '@/lib/storage/indexeddb'
import type { PrivateVaultSession } from './vault-session'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

const CONFLICT_KEY = 'private-vault-conflict'

export type PrivateVaultConflictRecord = {
  readonly key: typeof CONFLICT_KEY
  readonly otherRecord: PrivateVaultRecord
}

export async function saveVaultConflict(db: DbLike, otherRecord: PrivateVaultRecord): Promise<void> {
  const record: PrivateVaultConflictRecord = { key: CONFLICT_KEY, otherRecord }
  await db.put('settings', record)
}

export async function loadVaultConflict(db: DbLike): Promise<PrivateVaultConflictRecord | null> {
  const record = (await db.get('settings', CONFLICT_KEY)) as PrivateVaultConflictRecord | undefined
  return record ?? null
}

export async function clearVaultConflict(db: DbLike): Promise<void> {
  await db.delete('settings', CONFLICT_KEY)
}

/** True when `local` is the deterministic winner between the two differing
 *  vaults — reuses lib/sync/merge.ts's own tie-break (mergeVault's existing
 *  fallback for this exact "genuinely different vaults" case), so this
 *  module's notion of "target" is always consistent with what the sync
 *  engine itself would pick if it ever did merge them. Both sides calling
 *  this with their own "local" and the other's record arrive at consistent,
 *  opposite answers — no coordination between devices is needed. */
export function isLocalVaultTarget(local: PrivateVaultRecord, other: PrivateVaultRecord): boolean {
  return pickDeterministic(local, other) === local
}

/** True once the LOSING side's tag (identified by its id, from the
 *  conflict record's otherRecord.tagId as seen by the winning side, or
 *  vice versa) has synced in as a tombstone — the signal that
 *  mergeIntoOtherVault has already run successfully on the other device and
 *  its results have been pulled in here. Uses a raw store read (not
 *  getAllTags, which filters tombstones out) since the tombstoned state
 *  itself IS the answer. */
export async function isVaultConflictResolved(db: DbLike, otherTagId: string): Promise<boolean> {
  const tag = (await db.get('tags', otherTagId)) as { isDeleted?: boolean } | undefined
  return tag?.isDeleted === true
}

/** Runs on the LOSING ("source") side only, once its user has explicitly
 *  chosen to combine (screen: private.vaultConflictMergeConfirm). `session`
 *  is this device's OWN just-unlocked session (never the other vault's —
 *  that vault's password is never needed here, only its already-known
 *  PUBLIC key, via `otherRecord.publicKey`). For every bookmark currently
 *  tagged with this vault's tag: decrypt with this vault's own private key
 *  (already unlocked), re-encrypt under the other vault's public key, swap
 *  the tag reference. Then tombstone this vault's own tag (deleteTagCascade
 *  — safe now, since no bookmark still references it) and delete this
 *  vault's own record (retireVault). Order matters: every bookmark is
 *  re-encrypted and retagged BEFORE the tag/vault are retired, so a failure
 *  partway through never leaves data unreadable — it just leaves some
 *  bookmarks still on the old tag/vault, safely retryable. */
export async function mergeIntoOtherVault(
  db: DbLike,
  session: NonNullable<PrivateVaultSession>,
  otherRecord: PrivateVaultRecord,
): Promise<void> {
  const otherPublicKey = await importPublicKey(otherRecord.publicKey)
  const all = (await db.getAll('bookmarks')) as { id: string; tags: string[] }[]
  const ownIds = all.filter((b) => b.tags.includes(session.tagId)).map((b) => b.id)

  for (const id of ownIds) {
    const bookmark = await getBookmark(db, id)
    if (!bookmark || !bookmark.encryptedPayload) continue
    const decrypted = await decryptWithPrivateKey<Record<string, unknown>>(session.privateKey, bookmark.encryptedPayload)
    const encryptedPayload = await encryptWithPublicKey(otherPublicKey, decrypted)
    const tags = bookmark.tags.map((t) => (t === session.tagId ? otherRecord.tagId : t))
    await db.put('bookmarks', touchBookmark({ ...bookmark, encryptedPayload, tags }))
  }

  await deleteTagCascade(db, session.tagId)
  await retireVault(db)
}
