import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { openDB, type IDBPDatabase } from 'idb'
import {
  touchBookmark,
  addBookmark,
  addBookmarkBatch,
  updateBookmarkOgp,
  persistCustomCardWidth,
  persistPhotos,
  persistMediaSlots,
  updateBookmarkOrderBatch,
  updateBookmarkOrderIndex,
  clearCustomCardWidth,
  clearAllCustomCardWidths,
  resortByNewestFirst,
  updateBookmarkHealth,
} from '@/lib/storage/indexeddb'
import type { BookmarkRecord } from '@/lib/storage/indexeddb'

/* eslint-disable @typescript-eslint/no-explicit-any */
type TestDb = IDBPDatabase<any>
const TEST_DB = 'allmarks-test-bookmark-updatedat'

async function makeDb(): Promise<TestDb> {
  return openDB(TEST_DB, 1, {
    upgrade(db) {
      const bs = db.createObjectStore('bookmarks', { keyPath: 'id' })
      bs.createIndex('by-tag', 'tags', { multiEntry: true })
      const cs = db.createObjectStore('cards', { keyPath: 'id' })
      cs.createIndex('by-bookmark', 'bookmarkId')
      db.createObjectStore('settings', { keyPath: 'key' })
      db.createObjectStore('tags', { keyPath: 'id' })
    },
  })
}

function seedBookmark(id: string, over: Partial<BookmarkRecord> = {}): BookmarkRecord {
  return {
    id, url: `https://example.com/${id}`, title: id, description: '', thumbnail: '',
    favicon: '', siteName: '', type: 'website', savedAt: '2026-01-01T00:00:00.000Z',
    ogpStatus: 'fetched', tags: [], updatedAt: 1000, ...over,
  } as BookmarkRecord
}

describe('touchBookmark (pure)', () => {
  it('returns a copy with updatedAt = Date.now()', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_234_567)
    const rec = seedBookmark('b1', { updatedAt: 1 })
    const out = touchBookmark(rec)
    expect(out.updatedAt).toBe(1_234_567)
    expect(out).not.toBe(rec)
    expect(out.id).toBe('b1')
    vi.restoreAllMocks()
  })

  it('does not mutate its input', () => {
    vi.spyOn(Date, 'now').mockReturnValue(9_999_999)
    const rec = seedBookmark('b1', { updatedAt: 1, tags: ['t'] })
    const snapshot = JSON.parse(JSON.stringify(rec))
    touchBookmark(rec)
    expect(rec.updatedAt).toBe(1)
    expect(rec).toEqual(snapshot)
    vi.restoreAllMocks()
  })
})

describe('bookmark write paths bump updatedAt', () => {
  let db: TestDb
  beforeEach(async () => {
    const dbs = await indexedDB.databases()
    for (const i of dbs) if (i.name) indexedDB.deleteDatabase(i.name)
    db = await makeDb()
  })
  afterEach(() => db.close())

  it('addBookmark sets updatedAt on the new record', async () => {
    const before = Date.now()
    const bm = await addBookmark(db as any, {
      url: 'https://x.com/a', title: 'a', description: '', thumbnail: '',
      favicon: '', siteName: '', type: 'website',
    })
    expect(bm.updatedAt).toBeGreaterThanOrEqual(before)
  })

  it('addBookmarkBatch sets updatedAt on every record', async () => {
    const before = Date.now()
    const out = await addBookmarkBatch(db as any, [
      { url: 'https://x.com/1', title: '1', description: '', thumbnail: '', favicon: '', siteName: '', type: 'website' },
      { url: 'https://x.com/2', title: '2', description: '', thumbnail: '', favicon: '', siteName: '', type: 'website' },
    ])
    for (const b of out) expect(b.updatedAt).toBeGreaterThanOrEqual(before)
  })

  it('updateBookmarkOgp bumps updatedAt', async () => {
    await db.put('bookmarks', seedBookmark('b1', { updatedAt: 1000 }))
    await updateBookmarkOgp(db as any, 'b1', { title: 'new', ogpStatus: 'fetched' })
    const b = await db.get('bookmarks', 'b1')
    expect(b.updatedAt).toBeGreaterThan(1000)
  })

  it('persistCustomCardWidth bumps updatedAt', async () => {
    await db.put('bookmarks', seedBookmark('b1', { updatedAt: 1000 }))
    await persistCustomCardWidth(db as any, 'b1', 300)
    const b = await db.get('bookmarks', 'b1')
    expect(b.updatedAt).toBeGreaterThan(1000)
  })

  it('persistPhotos bumps updatedAt when it actually writes', async () => {
    await db.put('bookmarks', seedBookmark('b1', { updatedAt: 1000 }))
    await persistPhotos(db as any, 'b1', ['https://img/1', 'https://img/2'])
    const b = await db.get('bookmarks', 'b1')
    expect(b.updatedAt).toBeGreaterThan(1000)
  })

  it('persistPhotos does NOT bump on a deep-equal no-op', async () => {
    await db.put('bookmarks', seedBookmark('b1', { updatedAt: 1000, photos: ['https://img/1'] }))
    await persistPhotos(db as any, 'b1', ['https://img/1'])
    const b = await db.get('bookmarks', 'b1')
    expect(b.updatedAt).toBe(1000)
  })

  it('persistMediaSlots does NOT bump on a deep-equal no-op', async () => {
    const slots = [{ type: 'photo' as const, url: 'https://img/1', videoUrl: undefined, aspect: 1 }]
    await db.put('bookmarks', seedBookmark('b1', { updatedAt: 1000, mediaSlots: slots }))
    await persistMediaSlots(db as any, 'b1', slots)
    const b = await db.get('bookmarks', 'b1')
    expect(b.updatedAt).toBe(1000)
  })

  it('persistMediaSlots bumps updatedAt when it actually writes', async () => {
    await db.put('bookmarks', seedBookmark('b1', { updatedAt: 1000 }))
    await persistMediaSlots(db as any, 'b1', [
      { type: 'photo' as const, url: 'https://img/1', videoUrl: undefined, aspect: 1 },
    ])
    const b = await db.get('bookmarks', 'b1')
    expect(b.updatedAt).toBeGreaterThan(1000)
  })

  it('clearCustomCardWidth bumps updatedAt when the flag was set', async () => {
    await db.put('bookmarks', seedBookmark('b1', { updatedAt: 1000, customCardWidth: true }))
    await clearCustomCardWidth(db as any, 'b1')
    const b = await db.get('bookmarks', 'b1')
    expect(b.customCardWidth).toBe(false)
    expect(b.updatedAt).toBeGreaterThan(1000)
  })

  it('clearCustomCardWidth does NOT bump when the flag was already unset', async () => {
    await db.put('bookmarks', seedBookmark('b1', { updatedAt: 1000 }))
    await clearCustomCardWidth(db as any, 'b1')
    const b = await db.get('bookmarks', 'b1')
    expect(b.updatedAt).toBe(1000)
  })

  it('clearAllCustomCardWidths bumps updatedAt only on rows that had the flag', async () => {
    await db.put('bookmarks', seedBookmark('b1', { updatedAt: 1000, customCardWidth: true }))
    await db.put('bookmarks', seedBookmark('b2', { updatedAt: 1000 }))
    const cleared = await clearAllCustomCardWidths(db as any)
    expect(cleared).toEqual(['b1'])
    expect((await db.get('bookmarks', 'b1')).updatedAt).toBeGreaterThan(1000)
    expect((await db.get('bookmarks', 'b2')).updatedAt).toBe(1000)
  })

  it('updateBookmarkOrderIndex bumps updatedAt', async () => {
    await db.put('bookmarks', seedBookmark('b1', { updatedAt: 1000, orderIndex: 0 }))
    await updateBookmarkOrderIndex(db as any, 'b1', 7)
    const b = await db.get('bookmarks', 'b1')
    expect(b.orderIndex).toBe(7)
    expect(b.updatedAt).toBeGreaterThan(1000)
  })

  it('updateBookmarkOrderBatch bumps updatedAt on reordered rows', async () => {
    await db.put('bookmarks', seedBookmark('b1', { updatedAt: 1000, orderIndex: 0 }))
    await db.put('bookmarks', seedBookmark('b2', { updatedAt: 1000, orderIndex: 1 }))
    await updateBookmarkOrderBatch(db as any, ['b1', 'b2'])
    const b1 = await db.get('bookmarks', 'b1')
    expect(b1.updatedAt).toBeGreaterThan(1000)
  })

  it('resortByNewestFirst bumps updatedAt on rows whose order changes', async () => {
    await db.put('bookmarks', seedBookmark('b1', { updatedAt: 1000, savedAt: '2026-01-01T00:00:00.000Z', orderIndex: 5 }))
    await db.put('bookmarks', seedBookmark('b2', { updatedAt: 1000, savedAt: '2026-02-01T00:00:00.000Z', orderIndex: 5 }))
    await resortByNewestFirst(db as any)
    const b2 = await db.get('bookmarks', 'b2')
    expect(b2.updatedAt).toBeGreaterThan(1000)
  })

  it('updateBookmarkHealth does NOT bump updatedAt (passive revalidation)', async () => {
    await db.put('bookmarks', seedBookmark('b1', { updatedAt: 1000 }))
    await updateBookmarkHealth(db as any, 'b1', { linkStatus: 'alive', lastCheckedAt: Date.now() })
    const b = await db.get('bookmarks', 'b1')
    expect(b.updatedAt).toBe(1000)
  })

  it('addTagToBookmark bumps updatedAt', async () => {
    const { addTagToBookmark } = await import('@/lib/storage/tags')
    await db.put('bookmarks', seedBookmark('b1', { updatedAt: 1000 }))
    await addTagToBookmark(db as any, 'b1', 'tag-x')
    const b = await db.get('bookmarks', 'b1')
    expect(b.updatedAt).toBeGreaterThan(1000)
  })

  it('removeTagFromBookmark bumps updatedAt', async () => {
    const { removeTagFromBookmark } = await import('@/lib/storage/tags')
    await db.put('bookmarks', seedBookmark('b1', { updatedAt: 1000, tags: ['tag-x'] }))
    await removeTagFromBookmark(db as any, 'b1', 'tag-x')
    const b = await db.get('bookmarks', 'b1')
    expect(b.updatedAt).toBeGreaterThan(1000)
  })

  it('deleteTagCascade bumps updatedAt on scrubbed bookmarks', async () => {
    const { deleteTagCascade } = await import('@/lib/storage/tags')
    await db.put('tags', { id: 'g1', name: 'x', color: '#000', order: 0, createdAt: 1 })
    await db.put('bookmarks', seedBookmark('b1', { updatedAt: 1000, tags: ['g1'] }))
    await deleteTagCascade(db as any, 'g1')
    const b = await db.get('bookmarks', 'b1')
    expect(b.tags).toEqual([])
    expect(b.updatedAt).toBeGreaterThan(1000)
  })
})
