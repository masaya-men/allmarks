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
//
// Second detection path (added 2026-09-21, closing a gap found in final
// whole-branch review): the above relies on a device locally observing a
// vault.json pulled from Drive that differs from its own (vaultRecordsDiffer
// in lib/sync/engine.ts), which is what populates saveVaultConflict. But if
// the eventual deterministic TARGET also happens to be the device that
// published vault.json to Drive first — a chronological accident unrelated
// to the tie-break — it never pulls back anything different from what it
// already has, so loadVaultConflict never fires there and it would
// otherwise never learn a conflict exists at all. Ordinary tags (including
// each vault's isPrivateVault tag) sync independently of any vault
// conflict — engine.ts only ever nulls the `vault` field of a snapshot, tags
// sync as normal regardless — so every device eventually receives BOTH
// vaults' isPrivateVault tag via ordinary tag sync no matter which side
// published first. That gives a second, symmetric signal: if a device's own
// allPrivateTagIds contains more than just its own resolved privateTagId, a
// conflict exists even with no loadVaultConflict record. A device in that
// state can only ever be the deterministic target — the losing side always
// eventually pulls a vault.json that differs from its own (either the
// winner already overwrote it, or a later force-publish supersedes what was
// there when the losing side first synced), so loadVaultConflict is always
// eventually populated on the losing side by the existing code, with no
// gap; the only way to hold multiple Private tags locally while never
// having observed a mismatch is to be the side whose own vault.json was
// simply never overwritten. So this fallback (otherPrivateTagIds /
// anyOtherPrivateTagUnresolved below) can safely assume "I am the target"
// outright, without calling isLocalVaultTarget or reconstructing the other
// side's full PrivateVaultRecord — it only needs the other tag id(s) and
// whether they're tombstoned yet.
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

/** Every Private tag id besides `myTagId` — used by the fallback detection
 *  path below for the device that never locally observed a vault.json
 *  mismatch (see this module's header comment on the "first publisher who
 *  also wins" gap: that device is provably always the deterministic
 *  target, so it never needs loadVaultConflict/isLocalVaultTarget to know
 *  this — it only needs to know which other tag(s) exist and whether
 *  they've been tombstoned yet). */
export function otherPrivateTagIds(allPrivateTagIds: ReadonlySet<string>, myTagId: string | null): string[] {
  return [...allPrivateTagIds].filter((id) => id !== myTagId)
}

/** True if any of `otherTagIds` has NOT yet been tombstoned — i.e. the
 *  other side hasn't combined yet. Reuses isVaultConflictResolved per id;
 *  designed for the (normally single-element) fallback-detection case
 *  above, not a general multi-way merge. */
export async function anyOtherPrivateTagUnresolved(db: DbLike, otherTagIds: readonly string[]): Promise<boolean> {
  for (const id of otherTagIds) {
    if (!(await isVaultConflictResolved(db, id))) return true
  }
  return false
}

/** Runs on the LOSING ("source") side only, once its user has explicitly
 *  chosen to combine (screen: private.vaultConflictMergeConfirm). `session`
 *  is this device's OWN just-unlocked session (never the other vault's —
 *  that vault's password is never needed here, only its already-known
 *  PUBLIC key, via `otherRecord.publicKey`). For every bookmark currently
 *  tagged with this vault's tag: decrypt with this vault's own private key
 *  (already unlocked), re-encrypt under the other vault's public key, swap
 *  the tag reference. Then tombstone this vault's own tag (deleteTagCascade
 *  — safe now, since no bookmark still references it), delete this vault's
 *  own record (retireVault), and immediately adopt the target's public
 *  vault record locally (`db.put('settings', otherRecord)`) — the same
 *  "adopt the other side's public vault record" step lib/sync/engine.ts's
 *  applySnapshotToLocal already performs on an ordinary sync pull, done
 *  immediately instead of waiting for the next sync cycle. So the local
 *  vault does NOT end up simply absent after this runs — it ends up
 *  pointing at the OTHER side's record. Order matters: every bookmark is
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
  await db.put('settings', otherRecord)
}
