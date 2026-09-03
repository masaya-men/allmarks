import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { openDB, type IDBPDatabase } from 'idb'
import { addTag, getAllTags, deleteTag, deleteTagCascade } from '@/lib/storage/tags'
import type { BookmarkRecord } from '@/lib/storage/indexeddb'

/* eslint-disable @typescript-eslint/no-explicit-any */
type TestDb = IDBPDatabase<any>
const TEST_DB = 'allmarks-test-tags-soft-delete'

async function makeDb(): Promise<TestDb> {
  return openDB(TEST_DB, 1, {
    upgrade(db) {
      db.createObjectStore('tags', { keyPath: 'id' })
      const bs = db.createObjectStore('bookmarks', { keyPath: 'id' })
      bs.createIndex('by-tag', 'tags', { multiEntry: true })
    },
  })
}

function makeBookmark(id: string, tags: string[]): BookmarkRecord {
  return {
    id, url: `https://example.com/${id}`, title: id, description: '', thumbnail: '',
    favicon: '', siteName: '', type: 'website', savedAt: '2026-01-01T00:00:00.000Z',
    ogpStatus: 'fetched', tags, updatedAt: 1000,
  } as BookmarkRecord
}

describe('tag soft delete', () => {
  let db: TestDb
  beforeEach(async () => {
    const dbs = await indexedDB.databases()
    for (const i of dbs) if (i.name) indexedDB.deleteDatabase(i.name)
    db = await makeDb()
  })
  afterEach(() => db.close())

  it('deleteTag writes a tombstone instead of physically removing', async () => {
    const t = await addTag(db, { name: 'x', color: '#000', order: 0 })
    await deleteTag(db, t.id)
    const raw = await db.get('tags', t.id)
    expect(raw).toBeDefined()
    expect(raw.isDeleted).toBe(true)
    expect(typeof raw.deletedAt).toBe('string')
    expect(raw.updatedAt).toBeGreaterThanOrEqual(t.createdAt)
  })

  it('getAllTags excludes tombstoned tags', async () => {
    const a = await addTag(db, { name: 'a', color: '#000', order: 0 })
    const b = await addTag(db, { name: 'b', color: '#000', order: 1 })
    await deleteTag(db, a.id)
    const list = await getAllTags(db)
    expect(list.map((t) => t.id)).toEqual([b.id])
  })

  it('raw db.getAll still returns tombstones (backup carries them)', async () => {
    const a = await addTag(db, { name: 'a', color: '#000', order: 0 })
    await deleteTag(db, a.id)
    const raw = await db.getAll('tags')
    expect(raw).toHaveLength(1)
  })

  it('deleteTagCascade tombstones the tag AND still scrubs bookmarks', async () => {
    const a = await addTag(db, { name: 'a', color: '#000', order: 0 })
    await db.put('bookmarks', makeBookmark('b1', [a.id]))
    await deleteTagCascade(db, a.id)
    const tag = await db.get('tags', a.id)
    expect(tag.isDeleted).toBe(true)
    const b1 = await db.get('bookmarks', 'b1')
    expect(b1.tags).toEqual([])
    expect(b1.updatedAt).toBeGreaterThan(1000)
    // gone from the visible list
    expect(await getAllTags(db)).toEqual([])
  })

  it('a fresh tag with the same name after delete gets a new id and shows', async () => {
    const a = await addTag(db, { name: 'Art', color: '#000', order: 0 })
    await deleteTag(db, a.id)
    const a2 = await addTag(db, { name: 'Art', color: '#000', order: 0 })
    expect(a2.id).not.toBe(a.id)
    expect((await getAllTags(db)).map((t) => t.id)).toEqual([a2.id])
  })
})
