import type { IDBPDatabase } from 'idb'
import { touchBookmark } from './indexeddb'
import type { TagRecord, TagInput, BookmarkRecord, AllMarksDB } from './indexeddb'

/** The typed handle the tag helpers operate on. Was `IDBPDatabase<any>` (audit
 *  rank32); now the real schema so store/key access is type-checked. */
type DbLike = IDBPDatabase<AllMarksDB>

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
 * store 名は `'tags'` (= Task 5 の v14→v15 migration で `'moods'` → `'tags'`
 * に切替済み)。 legacy `moods` store は rollback safety のため物理的に残って
 * いるが、 書き込みは全て `tags` に行う。
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
    // Only present when the onboarding demo created it; absent on real tags.
    ...(input.onboardingDemo ? { onboardingDemo: true } : {}),
    // Only present when creating the Private vault tag; absent on regular tags.
    ...(input.isPrivateVault ? { isPrivateVault: true } : {}),
  }
  await db.put('tags', tag)
  return tag
}

/**
 * Get all tags sorted by their order field (ascending).
 * @param db - The database instance
 * @returns Array of TagRecord
 */
export async function getAllTags(db: DbLike): Promise<TagRecord[]> {
  const list = (await db.getAll('tags')) as TagRecord[]
  return list.filter((t) => !t.isDeleted).sort((a, b) => a.order - b.order)
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
  const existing = (await db.get('tags', id)) as TagRecord | undefined
  if (!existing) return
  await db.put('tags', { ...existing, ...updates, updatedAt: Date.now() })
}

/**
 * The isDeleted/deletedAt/updatedAt tombstone stamp shared by deleteTag and
 * deleteTagCascade. Soft-delete instead of physical removal so the
 * device-sync merge can tell a deleted tag from a not-yet-created one.
 */
function tombstone(tag: TagRecord): TagRecord {
  return {
    ...tag,
    isDeleted: true,
    deletedAt: new Date().toISOString(),
    updatedAt: Date.now(),
  }
}

/**
 * Soft-delete a tag by id — writes an isDeleted/deletedAt tombstone rather
 * than physically removing it, so the device-sync merge can tell a deleted
 * tag from a not-yet-created one. No-op if it doesn't exist. getAllTags
 * filters tombstones out of every read path.
 * @param db - The database instance
 * @param id - The tag ID to delete
 */
export async function deleteTag(db: DbLike, id: string): Promise<void> {
  const existing = (await db.get('tags', id)) as TagRecord | undefined
  if (!existing) return
  await db.put('tags', tombstone(existing))
}

/**
 * Soft-delete a tag (isDeleted/deletedAt tombstone) AND scrub every bookmark's
 * `tags[]` of the same id. The scrub is unchanged from the physical-delete era —
 * non-sync UX is identical: the tag vanishes from every getAllTags read path and
 * no bookmark is left pointing at it; the tombstone only sleeps in the `tags`
 * store until a sync merge needs it. Single transaction over both stores so we
 * never leave dangling refs even if the user navigates / refreshes mid-write.
 * @param db - The database instance
 * @param tagId - The tag ID to delete and scrub
 */
export async function deleteTagCascade(db: DbLike, tagId: string): Promise<void> {
  const tx = db.transaction(['tags', 'bookmarks'], 'readwrite')
  const tagStore = tx.objectStore('tags')
  const existing = (await tagStore.get(tagId)) as TagRecord | undefined
  if (existing) {
    await tagStore.put(tombstone(existing))
  }
  const bookmarkStore = tx.objectStore('bookmarks')
  const all = (await bookmarkStore.getAll()) as BookmarkRecord[]
  for (const b of all) {
    if (b.tags.includes(tagId)) {
      await bookmarkStore.put(touchBookmark({ ...b, tags: b.tags.filter((t: string) => t !== tagId) }))
    }
  }
  await tx.done
}

/**
 * Atomically rewrite tag order based on the supplied id sequence.
 * Each id receives its array index as its new order. Missing ids are skipped.
 * @param db - The database instance
 * @param orderedIds - The new complete order by id
 */
export async function reorderTags(db: DbLike, orderedIds: readonly string[]): Promise<void> {
  const tx = db.transaction('tags', 'readwrite')
  const store = tx.objectStore('tags')
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
 * 指定 bookmark にタグを 1 件追加する。
 * 重複は自動でスキップ。 bookmark が存在しなければ no-op。
 * get + put を単一の readwrite transaction でくくり、 同じ bookmark への
 * 同時 click race condition (= 後勝ち上書きによる片方消失) を防ぐ。
 * @param db - The database instance
 * @param bookmarkId - The bookmark ID to mutate
 * @param tagId - The tag ID to attach
 */
export async function addTagToBookmark(
  db: DbLike,
  bookmarkId: string,
  tagId: string,
): Promise<void> {
  const tx = db.transaction('bookmarks', 'readwrite')
  const store = tx.objectStore('bookmarks')
  const bookmark = (await store.get(bookmarkId)) as BookmarkRecord | undefined
  if (!bookmark) {
    await tx.done
    return
  }
  if (bookmark.tags.includes(tagId)) {
    await tx.done
    return
  }
  await store.put(touchBookmark({ ...bookmark, tags: [...bookmark.tags, tagId] }))
  await tx.done
}

/**
 * 指定 bookmark からタグを 1 件除去する。
 * 無ければ no-op (= tag 未付与 / bookmark 不在 両方)。
 * get + put を単一の readwrite transaction でくくり、 同じ bookmark への
 * 同時 click race condition (= 後勝ち上書きによる片方消失) を防ぐ。
 * @param db - The database instance
 * @param bookmarkId - The bookmark ID to mutate
 * @param tagId - The tag ID to detach
 */
export async function removeTagFromBookmark(
  db: DbLike,
  bookmarkId: string,
  tagId: string,
): Promise<void> {
  const tx = db.transaction('bookmarks', 'readwrite')
  const store = tx.objectStore('bookmarks')
  const bookmark = (await store.get(bookmarkId)) as BookmarkRecord | undefined
  if (!bookmark) {
    await tx.done
    return
  }
  if (!bookmark.tags.includes(tagId)) {
    await tx.done
    return
  }
  await store.put(touchBookmark({
    ...bookmark,
    tags: bookmark.tags.filter((t: string) => t !== tagId),
  }))
  await tx.done
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
