import type { IDBPDatabase } from 'idb'
import { getBookmark } from '@/lib/storage/indexeddb'
import { encryptJson, decryptJson } from './crypto'
import type { PrivateVaultSession } from './vault-session'
import type { MediaSlot } from '@/lib/embed/types'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

type PrivateFields = {
  readonly title: string
  readonly url: string
  readonly description: string
  readonly thumbnail: string
  readonly favicon: string
  readonly siteName: string
  readonly photos?: readonly string[]
  readonly mediaSlots?: readonly MediaSlot[]
}

const BLANK_FIELDS: PrivateFields = {
  title: '', url: '', description: '', thumbnail: '', favicon: '', siteName: '',
  photos: undefined, mediaSlots: undefined,
}

/** Encrypts the bookmark's sensitive fields, blanks the plaintext columns,
 *  then adds the Private tag — all in ONE transaction (final whole-branch
 *  review finding: two separate transactions could leave a blanked-but-
 *  untagged or tagged-but-plaintext row on a failure between them).
 *  Known limitation (documented, not fixed here): because `url` is blanked
 *  at rest, the URL-based dedupe check (saveBookmarkDeduped) can no longer
 *  see a Private bookmark's URL, so re-saving the same URL while it's
 *  privately stored will not be flagged as a duplicate. Acceptable for
 *  Phase 1 — revisit only if it bites someone in practice. */
export async function addPrivateTag(
  db: DbLike,
  bookmarkId: string,
  privateTagId: string,
  session: PrivateVaultSession,
): Promise<void> {
  if (session === null) throw new Error('vault is locked')
  const bookmark = await getBookmark(db, bookmarkId)
  if (!bookmark) return
  const fields: PrivateFields = {
    title: bookmark.title,
    url: bookmark.url,
    description: bookmark.description,
    thumbnail: bookmark.thumbnail,
    favicon: bookmark.favicon,
    siteName: bookmark.siteName,
    photos: bookmark.photos,
    mediaSlots: bookmark.mediaSlots,
  }
  const encryptedPayload = await encryptJson(session.key, fields)
  const tx = db.transaction('bookmarks', 'readwrite')
  const store = tx.objectStore('bookmarks')
  const current = await store.get(bookmarkId)
  if (!current) { await tx.done; return }
  const tags = current.tags.includes(privateTagId) ? current.tags : [...current.tags, privateTagId]
  await store.put({ ...current, ...BLANK_FIELDS, encryptedPayload, tags })
  await tx.done
}

/** Decrypts the bookmark's sensitive fields back to plaintext columns,
 *  clears encryptedPayload, then removes the Private tag — all in ONE
 *  transaction (see addPrivateTag's doc comment for why). Still removes the
 *  tag even if there's no encryptedPayload to restore from (a defensive
 *  recovery path — should not occur once every write path is corrected, but
 *  doesn't destroy data if it ever does). */
export async function removePrivateTag(
  db: DbLike,
  bookmarkId: string,
  privateTagId: string,
  session: PrivateVaultSession,
): Promise<void> {
  if (session === null) throw new Error('vault is locked')
  const bookmark = await getBookmark(db, bookmarkId)
  if (!bookmark) return
  const fields = bookmark.encryptedPayload
    ? await decryptJson<PrivateFields>(session.key, bookmark.encryptedPayload.iv, bookmark.encryptedPayload.ciphertext)
    : null
  const tx = db.transaction('bookmarks', 'readwrite')
  const store = tx.objectStore('bookmarks')
  const current = await store.get(bookmarkId)
  if (!current) { await tx.done; return }
  const { encryptedPayload: _drop, ...rest } = current
  const tags = current.tags.filter((t: string) => t !== privateTagId)
  await store.put(fields ? { ...rest, ...fields, tags } : { ...rest, tags })
  await tx.done
}

export type PrivateStatus = 'none' | 'locked' | 'unlocked'

/** Derives the 3-state Private status. Pure — no IDB access. `privateTagId`
 *  null means the vault has never been set up; a non-null id with a null
 *  session means it exists but is locked. */
export function resolvePrivateStatus(
  privateTagId: string | null,
  session: PrivateVaultSession,
): PrivateStatus {
  if (privateTagId === null) return 'none'
  if (session === null) return 'locked'
  return 'unlocked'
}

/** Sentinel drop-target key for the MANAGE TAGS panel's pinned Private row —
 *  parallel to CardsLayer's own `'__new__'` sentinel for the "+ NEW TAG" row
 *  (components/board/CardsLayer.tsx handleTagDrop routing). Not a real
 *  TagRecord id, so the row can render even before the vault is set up
 *  (when there is no real Private tag id yet). */
export const PRIVATE_DROP_KEY = '__private__'

/** A Private action deferred behind a setup/unlock dialog, resumed once the
 *  vault becomes unlocked. `toggle-tag` carries `currentlyTagged` computed by
 *  the caller at click time — a bookmark visible while the vault is
 *  locked/unset can never already carry the Private tag (resolvePrivateVisibility
 *  drops such rows before they reach the board), so callers building this
 *  action from a locked/none state always pass `currentlyTagged: false`.
 *  `filter` has no IDB side effect — it toggles the board's active tag
 *  filter, which the caller applies itself (see executePrivateAction's doc). */
export type PendingPrivateAction =
  | { readonly kind: 'toggle-tag'; readonly bookmarkId: string; readonly currentlyTagged: boolean }
  | { readonly kind: 'filter' }
  | { readonly kind: 'batch-encrypt'; readonly bookmarkIds: readonly string[] }

/** Encrypts each bookmark not already Private, one at a time (each call is
 *  its own atomic transaction via addPrivateTag — see that function's doc).
 *  Additive only, mirroring the plain-tag drag-and-drop's "union, skip
 *  already-tagged" semantics (BoardRoot's assignTagToCards). A bookmark id
 *  that doesn't exist is silently skipped (neither list) — same no-op
 *  contract as addPrivateTag itself. A failure on one card (e.g. a null
 *  session) doesn't stop the rest; failed ids come back so the caller can
 *  report them. */
export async function addPrivateTagBatch(
  db: DbLike,
  bookmarkIds: readonly string[],
  privateTagId: string,
  session: PrivateVaultSession,
): Promise<{ readonly succeeded: readonly string[]; readonly failed: readonly string[] }> {
  const succeeded: string[] = []
  const failed: string[] = []
  for (const id of bookmarkIds) {
    try {
      const bookmark = await getBookmark(db, id)
      if (!bookmark) continue
      if (bookmark.tags.includes(privateTagId)) { succeeded.push(id); continue }
      await addPrivateTag(db, id, privateTagId, session)
      succeeded.push(id)
    } catch {
      failed.push(id)
    }
  }
  return { succeeded, failed }
}

/** Executes an already-unlocked `toggle-tag` or `batch-encrypt` pending
 *  action. The `filter` kind is intentionally NOT accepted here — it has no
 *  IDB side effect; callers apply it directly via their own filter-change
 *  handler before ever constructing a call to this function. */
export async function executePrivateAction(
  db: DbLike,
  action: Extract<PendingPrivateAction, { kind: 'toggle-tag' | 'batch-encrypt' }>,
  privateTagId: string,
  session: PrivateVaultSession,
): Promise<{ readonly failed: readonly string[] }> {
  if (action.kind === 'toggle-tag') {
    try {
      if (action.currentlyTagged) {
        await removePrivateTag(db, action.bookmarkId, privateTagId, session)
      } else {
        await addPrivateTag(db, action.bookmarkId, privateTagId, session)
      }
      return { failed: [] }
    } catch {
      // Matches addPrivateTagBatch's per-card contract (see below): never
      // throw, always report failures via the return value. A throw here
      // would propagate out of the fire-and-forget `void runPrivateAction(...)`
      // call in BoardRoot.tsx as an unhandled rejection, skipping the
      // setPendingPrivateAction(null) cleanup that must always run (final
      // whole-branch review finding).
      return { failed: [action.bookmarkId] }
    }
  }
  const { failed } = await addPrivateTagBatch(db, action.bookmarkIds, privateTagId, session)
  return { failed }
}
