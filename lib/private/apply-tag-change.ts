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
