// lib/tagger/order-tags-for-save.ts
import type { BookmarkRecord, TagRecord } from '@/lib/storage/indexeddb'
import { scoreSimilarBookmarks } from '@/lib/board/tag-candidates'

/** Lightweight tag shape carried in the save response + rendered as a chip. */
export interface QuickTag {
  readonly id: string
  readonly name: string
  readonly color: string
}

/**
 * Order the user's existing tags "most relevant first" for the quick-tag strip
 * shown right after a save. Relevance reuses {@link scoreSimilarBookmarks}
 * (tags frequent on same-domain bookmarks rank higher). Tags it does not rank
 * keep their stored order after the ranked ones. The bookmark's own current
 * tags are intentionally NOT removed — the strip marks them as ✓.
 */
export function orderTagsForSave(
  target: BookmarkRecord,
  corpus: readonly BookmarkRecord[],
  allTags: readonly TagRecord[],
): QuickTag[] {
  const ranked = scoreSimilarBookmarks(target, corpus) // tag ids, relevance desc
  const rankedSet = new Set(ranked)
  const byId = new Map(allTags.map((t) => [t.id, t]))
  const orderedIds: string[] = []
  for (const id of ranked) if (byId.has(id)) orderedIds.push(id)
  for (const t of allTags) if (!rankedSet.has(t.id)) orderedIds.push(t.id)
  const seen = new Set<string>()
  const out: QuickTag[] = []
  for (const id of orderedIds) {
    if (seen.has(id)) continue
    seen.add(id)
    const t = byId.get(id)
    if (t) out.push({ id: t.id, name: t.name, color: t.color })
  }
  return out
}
