import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { type IDBPDatabase } from 'idb'
import {
  initDB,
  computeNewestFirstOrder,
  resortByNewestFirst,
} from '@/lib/storage/indexeddb'

let db: IDBPDatabase<unknown> | null = null

beforeEach(async () => {
  const databases = await indexedDB.databases()
  for (const info of databases) {
    if (info.name) indexedDB.deleteDatabase(info.name)
  }
})

afterEach(() => {
  if (db) { db.close(); db = null }
})

/** Minimal valid bookmark row for these tests. fake-indexeddb does not
 *  validate schema, so only the fields under test need to be realistic. */
function mkBookmark(id: string, savedAt: string, orderIndex: number): Record<string, unknown> {
  return {
    id, url: `https://example.com/${id}`, title: id, description: '',
    thumbnail: '', favicon: '', siteName: '', type: 'website',
    savedAt, ogpStatus: 'fetched', tags: [], displayMode: null,
    sizePreset: 'S', orderIndex,
  }
}

describe('computeNewestFirstOrder (pure)', () => {
  it('assigns highest orderIndex to the newest savedAt', () => {
    const out = computeNewestFirstOrder([
      { id: 'a', savedAt: '2026-01-01T00:00:00Z' },
      { id: 'b', savedAt: '2026-03-01T00:00:00Z' },
      { id: 'c', savedAt: '2026-02-01T00:00:00Z' },
    ])
    // b newest → orderIndex 2, c → 1, a → 0
    expect(out).toEqual([
      { id: 'b', orderIndex: 2 },
      { id: 'c', orderIndex: 1 },
      { id: 'a', orderIndex: 0 },
    ])
  })

  it('breaks savedAt ties by id ASC', () => {
    const out = computeNewestFirstOrder([
      { id: 'y', savedAt: '2026-01-01T00:00:00Z' },
      { id: 'x', savedAt: '2026-01-01T00:00:00Z' },
    ])
    // equal savedAt → id ASC (x before y) → x gets higher index
    expect(out).toEqual([
      { id: 'x', orderIndex: 1 },
      { id: 'y', orderIndex: 0 },
    ])
  })
})

describe('resortByNewestFirst (IDB)', () => {
  it('rewrites scrambled orderIndex to newest-first and reports updated count', async () => {
    const d = await initDB()
    db = d as unknown as IDBPDatabase<unknown>
    // Scrambled orderIndex vs savedAt: newest (b) currently has the LOWEST index.
    await d.put('bookmarks', mkBookmark('a', '2026-01-01T00:00:00Z', 5) as never)
    await d.put('bookmarks', mkBookmark('b', '2026-03-01T00:00:00Z', 0) as never)
    await d.put('bookmarks', mkBookmark('c', '2026-02-01T00:00:00Z', 9) as never)

    const { updated } = await resortByNewestFirst(d)
    expect(updated).toBe(3)

    const a = await d.get('bookmarks', 'a') as { orderIndex: number }
    const b = await d.get('bookmarks', 'b') as { orderIndex: number }
    const c = await d.get('bookmarks', 'c') as { orderIndex: number }
    expect(b.orderIndex).toBe(2) // newest → top under DESC
    expect(c.orderIndex).toBe(1)
    expect(a.orderIndex).toBe(0)
  })

  it('is a no-op (updated=0) when already newest-first', async () => {
    const d = await initDB()
    db = d as unknown as IDBPDatabase<unknown>
    await d.put('bookmarks', mkBookmark('a', '2026-01-01T00:00:00Z', 0) as never)
    await d.put('bookmarks', mkBookmark('b', '2026-03-01T00:00:00Z', 1) as never)
    const { updated } = await resortByNewestFirst(d)
    expect(updated).toBe(0)
  })

  it('handles an empty board without throwing', async () => {
    const d = await initDB()
    db = d as unknown as IDBPDatabase<unknown>
    const { updated } = await resortByNewestFirst(d)
    expect(updated).toBe(0)
  })
})
