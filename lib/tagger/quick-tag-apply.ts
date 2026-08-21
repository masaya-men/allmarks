import { addTag, addTagToBookmark, getAllTags } from '@/lib/storage/tags'
import { postBookmarkUpdated } from '@/lib/board/channel'
import type { TagRecord } from '@/lib/storage/indexeddb'

type DbLike = Parameters<typeof addTagToBookmark>[0]

/** Show the quick-tag window only when the feature is ON and no real PiP is
 *  open (the open PiP already receives the saved card; a second surface would
 *  collide — mirrors the phase-2 pipActive gate). */
export function shouldShowQuickTagWindow(quickTagEnabled: boolean, pipActive: boolean): boolean {
  return quickTagEnabled && !pipActive
}

/** True when `tagId` is the app-enforced Private vault tag. Re-reads the tag
 *  record directly from IDB rather than trusting a caller-supplied list —
 *  the Private tag must NEVER be attachable through this un-encrypting
 *  quick-tag path, regardless of lock state or what list a caller's own UI
 *  happens to be showing (mirrors the drag-and-drop bulk-assign exclusion;
 *  only the board's individual card toggle may attach it, because only
 *  that path encrypts). */
async function isPrivateVaultTagId(db: DbLike, tagId: string): Promise<boolean> {
  const tag = (await db.get('tags', tagId)) as TagRecord | undefined
  return tag?.isPrivateVault === true
}

/** Apply an existing tag to the just-saved bookmark and notify open boards.
 *  Returns false (no-op) when `tagId` is the Private vault tag. */
export async function applyExistingQuickTag(db: DbLike, bookmarkId: string, tagId: string): Promise<boolean> {
  if (await isPrivateVaultTagId(db, tagId)) return false
  await addTagToBookmark(db, bookmarkId, tagId)
  postBookmarkUpdated({ bookmarkId })
  return true
}

/** Find-or-create a tag by case-insensitive name, apply it, notify boards.
 *  Returns the tag used, or null for blank input OR when the matched name
 *  belongs to the Private vault tag (never created/reused through this
 *  path — always re-checks a FRESH unfiltered tag list from the DB for
 *  this, ignoring whatever `allTags` the caller passed in, since a caller
 *  may have already filtered Private out of its own display list). */
export async function applyNewQuickTag(
  db: DbLike,
  bookmarkId: string,
  name: string,
  allTags: readonly TagRecord[],
): Promise<TagRecord | null> {
  const trimmed = name.trim()
  if (!trimmed) return null
  const freshAll = await getAllTags(db)
  const existing = freshAll.find((t) => t.name.toLowerCase() === trimmed.toLowerCase())
  if (existing?.isPrivateVault === true) return null
  const target = existing ?? (await addTag(db, { name: trimmed, color: '#28F100', order: allTags.length }))
  await addTagToBookmark(db, bookmarkId, target.id)
  postBookmarkUpdated({ bookmarkId })
  return target
}
