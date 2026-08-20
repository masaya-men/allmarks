import type { IDBPDatabase } from 'idb'
import { getBookmark } from '@/lib/storage/indexeddb'
import { addTagToBookmark, removeTagFromBookmark } from '@/lib/storage/tags'
import { encryptJson, decryptJson } from './crypto'
import type { PrivateVaultSession } from './vault-session'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

type PrivateFields = {
  readonly title: string
  readonly url: string
  readonly description: string
  readonly thumbnail: string
  readonly favicon: string
  readonly siteName: string
}

const BLANK_FIELDS: PrivateFields = { title: '', url: '', description: '', thumbnail: '', favicon: '', siteName: '' }

/** Encrypts the bookmark's sensitive fields, blanks the plaintext columns,
 *  then adds the Private tag. Known limitation (documented, not fixed here):
 *  because `url` is blanked at rest, the URL-based dedupe check
 *  (saveBookmarkDeduped) can no longer see a Private bookmark's URL, so
 *  re-saving the same URL while it's privately stored will not be flagged
 *  as a duplicate. Acceptable for Phase 1 — revisit only if it bites someone
 *  in practice. */
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
  }
  const encryptedPayload = await encryptJson(session.key, fields)
  await db.put('bookmarks', { ...bookmark, ...BLANK_FIELDS, encryptedPayload })
  await addTagToBookmark(db, bookmarkId, privateTagId)
}

/** Decrypts the bookmark's sensitive fields back to plaintext columns,
 *  clears encryptedPayload, then removes the Private tag. */
export async function removePrivateTag(
  db: DbLike,
  bookmarkId: string,
  privateTagId: string,
  session: PrivateVaultSession,
): Promise<void> {
  if (session === null) throw new Error('vault is locked')
  const bookmark = await getBookmark(db, bookmarkId)
  if (!bookmark) return
  if (bookmark.encryptedPayload) {
    const fields = await decryptJson<PrivateFields>(
      session.key,
      bookmark.encryptedPayload.iv,
      bookmark.encryptedPayload.ciphertext,
    )
    const { encryptedPayload: _drop, ...rest } = bookmark
    await db.put('bookmarks', { ...rest, ...fields })
  }
  await removeTagFromBookmark(db, bookmarkId, privateTagId)
}
