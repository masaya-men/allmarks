import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { openDB, type IDBPDatabase } from 'idb'
import {
  addTag,
  getAllTags,
  updateTag,
  deleteTag,
  reorderTags,
  addTagToBookmark,
  removeTagFromBookmark,
  filterBookmarks,
} from '@/lib/storage/tags'
import type { BookmarkRecord } from '@/lib/storage/indexeddb'

const TEST_DB = 'allmarks-test-tags'

/* eslint-disable @typescript-eslint/no-explicit-any */
type TestDb = IDBPDatabase<any>

async function makeDb(): Promise<TestDb> {
  return await openDB(TEST_DB, 1, {
    upgrade(db) {
      // ⚠️ production と同じ store 名 'moods' で create
      // (Task 5 の v14→v15 migration で 'tags' に切替予定)
      db.createObjectStore('moods', { keyPath: 'id' })
      const bs = db.createObjectStore('bookmarks', { keyPath: 'id' })
      bs.createIndex('by-tag', 'tags', { multiEntry: true })
    },
  })
}

function makeBookmark(id: string, tags: string[]): BookmarkRecord {
  return {
    id,
    url: `https://example.com/${id}`,
    title: id,
    description: '',
    thumbnail: '',
    favicon: '',
    siteName: '',
    type: 'website',
    savedAt: new Date().toISOString(),
    ogpStatus: 'fetched',
    tags,
  } as BookmarkRecord
}

describe('tags storage', () => {
  let db: TestDb

  beforeEach(async () => {
    // 前テストの残骸を全消去 (= fake-indexeddb は process 内 persistent)
    const databases = await indexedDB.databases()
    for (const info of databases) {
      if (info.name) indexedDB.deleteDatabase(info.name)
    }
    db = await makeDb()
  })

  afterEach(() => {
    db.close()
  })

  // -------------------------------------------------------------------------
  // 既存 5 (= moods → tags rename 由来)
  // -------------------------------------------------------------------------

  it('addTag creates a tag with given fields', async () => {
    const t = await addTag(db, { name: 'アート', color: '#28F100', order: 0 })
    expect(t.id).toBeDefined()
    expect(t.name).toBe('アート')
    expect(t.createdAt).toBeGreaterThan(0)
    expect(t.updatedAt).toBe(t.createdAt)
  })

  it('getAllTags returns tags sorted by order', async () => {
    await addTag(db, { name: 'b', color: '#fff', order: 1 })
    await addTag(db, { name: 'a', color: '#fff', order: 0 })
    const list = await getAllTags(db)
    expect(list.map((t) => t.name)).toEqual(['a', 'b'])
  })

  it('updateTag merges fields and bumps updatedAt', async () => {
    const t = await addTag(db, { name: 'x', color: '#000', order: 0 })
    await new Promise((r) => setTimeout(r, 2))
    await updateTag(db, t.id, { name: 'y' })
    const list = await getAllTags(db)
    expect(list[0].name).toBe('y')
    expect(list[0].updatedAt).toBeGreaterThan(t.createdAt)
  })

  it('deleteTag removes the tag', async () => {
    const t = await addTag(db, { name: 'x', color: '#000', order: 0 })
    await deleteTag(db, t.id)
    expect(await getAllTags(db)).toEqual([])
  })

  it('reorderTags assigns new order from id sequence', async () => {
    const a = await addTag(db, { name: 'a', color: '#000', order: 0 })
    const b = await addTag(db, { name: 'b', color: '#000', order: 1 })
    await reorderTags(db, [b.id, a.id])
    const list = await getAllTags(db)
    expect(list.map((t) => t.name)).toEqual(['b', 'a'])
  })

  // -------------------------------------------------------------------------
  // 新規 8 (= bookmark ↔ tag relation API + filterBookmarks)
  // -------------------------------------------------------------------------

  it('addTagToBookmark appends if not present', async () => {
    await db.put('bookmarks', makeBookmark('b1', []))
    await addTagToBookmark(db, 'b1', 'tag-x')
    const b = await db.get('bookmarks', 'b1')
    expect(b?.tags).toEqual(['tag-x'])
  })

  it('addTagToBookmark is idempotent (no duplicate)', async () => {
    await db.put('bookmarks', makeBookmark('b1', ['tag-x']))
    await addTagToBookmark(db, 'b1', 'tag-x')
    const b = await db.get('bookmarks', 'b1')
    expect(b?.tags).toEqual(['tag-x'])
  })

  it('addTagToBookmark is no-op when bookmark does not exist', async () => {
    await addTagToBookmark(db, 'nonexistent', 'tag-x')
    expect(await db.get('bookmarks', 'nonexistent')).toBeUndefined()
  })

  it('removeTagFromBookmark drops the tag if present', async () => {
    await db.put('bookmarks', makeBookmark('b1', ['tag-x', 'tag-y']))
    await removeTagFromBookmark(db, 'b1', 'tag-x')
    const b = await db.get('bookmarks', 'b1')
    expect(b?.tags).toEqual(['tag-y'])
  })

  it('removeTagFromBookmark is no-op when tag not present', async () => {
    await db.put('bookmarks', makeBookmark('b1', ['tag-y']))
    await removeTagFromBookmark(db, 'b1', 'tag-x')
    const b = await db.get('bookmarks', 'b1')
    expect(b?.tags).toEqual(['tag-y'])
  })

  it('filterBookmarks empty tagIds returns all non-deleted', async () => {
    await db.put('bookmarks', makeBookmark('b1', []))
    await db.put('bookmarks', { ...makeBookmark('b2', []), isDeleted: true })
    const out = await filterBookmarks(db, { tagIds: [], mode: 'and' })
    expect(out.map((b) => b.id)).toEqual(['b1'])
  })

  it('filterBookmarks AND requires all tags', async () => {
    await db.put('bookmarks', makeBookmark('b1', ['a', 'b']))
    await db.put('bookmarks', makeBookmark('b2', ['a']))
    const out = await filterBookmarks(db, { tagIds: ['a', 'b'], mode: 'and' })
    expect(out.map((b) => b.id)).toEqual(['b1'])
  })

  it('filterBookmarks OR matches any tag', async () => {
    await db.put('bookmarks', makeBookmark('b1', ['a']))
    await db.put('bookmarks', makeBookmark('b2', ['b']))
    await db.put('bookmarks', makeBookmark('b3', ['c']))
    const out = await filterBookmarks(db, { tagIds: ['a', 'b'], mode: 'or' })
    expect(out.map((b) => b.id).sort()).toEqual(['b1', 'b2'])
  })
})
