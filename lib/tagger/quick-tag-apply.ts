import { addTag, addTagToBookmark } from '@/lib/storage/tags'
import { postBookmarkUpdated } from '@/lib/board/channel'
import type { TagRecord } from '@/lib/storage/indexeddb'

type DbLike = Parameters<typeof addTagToBookmark>[0]

/** Show the quick-tag window only when the feature is ON and no real PiP is
 *  open (the open PiP already receives the saved card; a second surface would
 *  collide — mirrors the phase-2 pipActive gate). */
export function shouldShowQuickTagWindow(quickTagEnabled: boolean, pipActive: boolean): boolean {
  return quickTagEnabled && !pipActive
}

/** Apply an existing tag to the just-saved bookmark and notify open boards. */
export async function applyExistingQuickTag(db: DbLike, bookmarkId: string, tagId: string): Promise<void> {
  await addTagToBookmark(db, bookmarkId, tagId)
  postBookmarkUpdated({ bookmarkId })
}

/** Find-or-create a tag by case-insensitive name, apply it, notify boards.
 *  Returns the tag used, or null for blank input. Mirrors PipCompanion.handleAddNew. */
export async function applyNewQuickTag(
  db: DbLike,
  bookmarkId: string,
  name: string,
  allTags: readonly TagRecord[],
): Promise<TagRecord | null> {
  const trimmed = name.trim()
  if (!trimmed) return null
  const existing = allTags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase())
  const target = existing ?? (await addTag(db, { name: trimmed, color: '#28F100', order: allTags.length }))
  await addTagToBookmark(db, bookmarkId, target.id)
  postBookmarkUpdated({ bookmarkId })
  return target
}
