import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { openDB, type IDBPDatabase } from 'idb'
import { initDB, type AllMarksDB } from '@/lib/storage/indexeddb'
import { DB_NAME } from '@/lib/constants'

let db: IDBPDatabase<AllMarksDB> | null = null

describe('IDB v16 → v17 migration (updatedAt backfill)', () => {
  beforeEach(async () => {
    const databases = await indexedDB.databases()
    for (const info of databases) {
      if (info.name) indexedDB.deleteDatabase(info.name)
    }
  })

  afterEach(() => {
    if (db) { db.close(); db = null }
  })

  async function seedV16(): Promise<void> {
    const v16 = await openDB(DB_NAME, 16, {
      upgrade(d) {
        const bs = d.createObjectStore('bookmarks', { keyPath: 'id' })
        bs.createIndex('by-tag', 'tags', { multiEntry: true })
        d.createObjectStore('tags', { keyPath: 'id' })
        d.createObjectStore('cards', { keyPath: 'id' })
        d.createObjectStore('settings', { keyPath: 'key' })
        d.createObjectStore('preferences', { keyPath: 'key' })
      },
    })
    await v16.put('bookmarks', {
      id: 'b1', url: 'https://example.com', title: 't', description: '', thumbnail: '',
      favicon: '', siteName: '', type: 'website', savedAt: '2026-01-15T09:30:00.000Z',
      ogpStatus: 'fetched', tags: [],
    })
    await v16.put('bookmarks', {
      id: 'b2', url: 'https://example.org', title: 't2', description: '', thumbnail: '',
      favicon: '', siteName: '', type: 'website', savedAt: '2026-02-20T12:00:00.000Z',
      ogpStatus: 'fetched', tags: [], updatedAt: 1_800_000_000_000,
    })
    // A corrupt/legacy row whose savedAt cannot be parsed.
    await v16.put('bookmarks', {
      id: 'b3', url: 'https://example.net', title: 't3', description: '', thumbnail: '',
      favicon: '', siteName: '', type: 'website', savedAt: 'not-a-date',
      ogpStatus: 'fetched', tags: [],
    })
    await v16.put('tags', { id: 'g1', name: 'Art', color: '#28F100', order: 0, createdAt: 1_700_000_000_000 })
    await v16.put('cards', {
      id: 'c1', bookmarkId: 'b1', folderId: '', x: 0, y: 0, rotation: 0, scale: 1,
      zIndex: 1, gridIndex: 0, isManuallyPlaced: false, width: 240, height: 300,
    })
    v16.close()
  }

  it('backfills updatedAt from savedAt for rows missing it', async () => {
    await seedV16()
    db = await initDB()
    const b1 = await db.get('bookmarks', 'b1')
    expect(b1?.updatedAt).toBe(Date.parse('2026-01-15T09:30:00.000Z'))
  })

  it('preserves an already-present updatedAt', async () => {
    await seedV16()
    db = await initDB()
    const b2 = await db.get('bookmarks', 'b2')
    expect(b2?.updatedAt).toBe(1_800_000_000_000)
  })

  it('uses updatedAt: 0 when savedAt is unparseable (corrupt row loses at merge)', async () => {
    await seedV16()
    db = await initDB()
    const b3 = await db.get('bookmarks', 'b3')
    expect(b3?.updatedAt).toBe(0)
  })

  it('leaves tags and cards untouched (no updatedAt forced onto them)', async () => {
    await seedV16()
    db = await initDB()
    const tag = await db.get('tags', 'g1')
    expect(tag?.updatedAt).toBeUndefined()
    const card = await db.get('cards', 'c1')
    expect((card as { updatedAt?: number }).updatedAt).toBeUndefined()
  })

  it('preserves bookmark payload across the upgrade', async () => {
    await seedV16()
    db = await initDB()
    const b1 = await db.get('bookmarks', 'b1')
    expect(b1?.url).toBe('https://example.com')
    expect(b1?.title).toBe('t')
  })
})
