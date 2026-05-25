import type { IDBPDatabase } from 'idb'
import type { TagRecord, TagInput, BookmarkRecord } from './indexeddb'

/* eslint-disable @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

/** Generate a UUID v4 */
function uuid(): string {
  return crypto.randomUUID()
}

/**
 * Create a new tag.
 * @param db - The database instance
 * @param input - Tag data (name, color, order)
 * @returns The created TagRecord
 *
 * ⚠️ store 名は `'moods'` のまま (= Task 5 の v14→v15 migration で `'tags'` に
 * 切替予定)。 今この時点で `'tags'` に書き換えると runtime で `NotFoundError`
 * になるので絶対に触らない。
 */
export async function addTag(db: DbLike, input: TagInput): Promise<TagRecord> {
  const now = Date.now()
  const tag: TagRecord = {
    id: uuid(),
    name: input.name,
    color: input.color,
    order: input.order,
    createdAt: now,
    updatedAt: now,
    theme: null,
  }
  await db.put('moods', tag)
  return tag
}

/**
 * Get all tags sorted by their order field (ascending).
 * @param db - The database instance
 * @returns Array of TagRecord
 */
export async function getAllTags(db: DbLike): Promise<TagRecord[]> {
  const list = (await db.getAll('moods')) as TagRecord[]
  return list.sort((a, b) => a.order - b.order)
}

/**
 * Update specific fields of a tag (id and createdAt are immutable).
 * `updatedAt` is automatically set to Date.now() on every successful merge.
 * @param db - The database instance
 * @param id - The tag ID to update
 * @param updates - Partial tag fields to merge
 */
export async function updateTag(
  db: DbLike,
  id: string,
  updates: Partial<Omit<TagRecord, 'id' | 'createdAt'>>,
): Promise<void> {
  const existing = (await db.get('moods', id)) as TagRecord | undefined
  if (!existing) return
  await db.put('moods', { ...existing, ...updates, updatedAt: Date.now() })
}

/**
 * Delete a tag by id. No-op if it doesn't exist.
 * @param db - The database instance
 * @param id - The tag ID to delete
 */
export async function deleteTag(db: DbLike, id: string): Promise<void> {
  await db.delete('moods', id)
}

/**
 * Atomically rewrite tag order based on the supplied id sequence.
 * Each id receives its array index as its new order. Missing ids are skipped.
 * @param db - The database instance
 * @param orderedIds - The new complete order by id
 */
export async function reorderTags(db: DbLike, orderedIds: readonly string[]): Promise<void> {
  const tx = db.transaction('moods', 'readwrite')
  const store = tx.objectStore('moods')
  for (let i = 0; i < orderedIds.length; i++) {
    const existing = (await store.get(orderedIds[i])) as TagRecord | undefined
    if (!existing) continue
    await store.put({ ...existing, order: i })
  }
  await tx.done
}

// ---------------------------------------------------------------------------
// Bookmark ↔ Tag relation API (= bookmark.tags[] への push/pull)
// ---------------------------------------------------------------------------

/**
 * 指定 bookmark にタグを 1 件追加する (= 重複は自動でスキップ)。
 * @param db - The database instance
 * @param bookmarkId - The bookmark ID to mutate
 * @param tagId - The tag ID to attach
 */
export async function addTagToBookmark(
  db: DbLike,
  bookmarkId: string,
  tagId: string,
): Promise<void> {
  const bookmark = (await db.get('bookmarks', bookmarkId)) as BookmarkRecord | undefined
  if (!bookmark) return
  if (bookmark.tags.includes(tagId)) return
  await db.put('bookmarks', { ...bookmark, tags: [...bookmark.tags, tagId] })
}

/**
 * 指定 bookmark からタグを 1 件除去する (= 無ければ no-op)。
 * @param db - The database instance
 * @param bookmarkId - The bookmark ID to mutate
 * @param tagId - The tag ID to detach
 */
export async function removeTagFromBookmark(
  db: DbLike,
  bookmarkId: string,
  tagId: string,
): Promise<void> {
  const bookmark = (await db.get('bookmarks', bookmarkId)) as BookmarkRecord | undefined
  if (!bookmark) return
  if (!bookmark.tags.includes(tagId)) return
  await db.put('bookmarks', {
    ...bookmark,
    tags: bookmark.tags.filter((t: string) => t !== tagId),
  })
}

/** Filter mode for {@link filterBookmarks}. */
export type FilterMode = 'and' | 'or'

/**
 * タグ id のリストで bookmark を絞り込む。
 * - mode='and': 指定タグを全て持つ bookmark のみ
 * - mode='or' : 指定タグのいずれかを持つ bookmark
 * - tagIds 空配列 = 絞り込み無し、 全件返す
 * - isDeleted=true の bookmark は除外
 * @param db - The database instance
 * @param opts - tagIds (絞り込み対象) と mode (AND / OR)
 * @returns 条件にマッチした BookmarkRecord 配列
 */
export async function filterBookmarks(
  db: DbLike,
  opts: { tagIds: readonly string[]; mode: FilterMode },
): Promise<BookmarkRecord[]> {
  const all = (await db.getAll('bookmarks')) as BookmarkRecord[]
  const active = all.filter((b) => !b.isDeleted)
  if (opts.tagIds.length === 0) return active
  if (opts.mode === 'and') {
    return active.filter((b) => opts.tagIds.every((tid) => b.tags.includes(tid)))
  }
  return active.filter((b) => opts.tagIds.some((tid) => b.tags.includes(tid)))
}
