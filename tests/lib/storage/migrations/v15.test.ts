import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { openDB, deleteDB } from 'idb'
import { initDB, type BookmarkRecord, type TagRecord } from '@/lib/storage/indexeddb'
import { DB_NAME } from '@/lib/constants'

/**
 * v15 migration unit tests — Task 6 of tagging-phase1.
 *
 * Verifies the v14 → v15 upgrade block in `lib/storage/indexeddb.ts`:
 *   1. `moods` records are copied to the new `tags` store with
 *      `updatedAt = createdAt` and `theme = null` defaulted.
 *   2. Existing bookmark.tags[] references (= legacy mood ids) are preserved.
 *   3. The bookmarks store gains a `by-tag` multiEntry index.
 *   4. Migrating a realistic data volume (200 bookmarks + 10 tags) succeeds.
 *   5. A cold-start install (v0 → v15) creates both stores empty + the index.
 *   6. Re-opening at v15 is idempotent (no data loss, no duplicate creation).
 *
 * fake-indexeddb persists across tests in-process, so `beforeEach` wipes
 * every database (not just DB_NAME) to guarantee clean state — same pattern
 * as `tests/lib/storage/tags.test.ts`.
 */

describe('v15 migration (moods → tags)', () => {
  beforeEach(async () => {
    // Wipe all databases — fake-indexeddb is process-persistent and the
    // production DB_NAME plus any leftovers from prior tests can leak across.
    const databases = await indexedDB.databases()
    for (const info of databases) {
      if (info.name) {
        await deleteDB(info.name)
      }
    }
  })

  it('v14 → v15: moods data copies to tags store with theme=null + updatedAt=createdAt', async () => {
    // Seed at v14 with the legacy `moods` + `bookmarks` shape.
    const v14 = await openDB(DB_NAME, 14, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('moods')) {
          db.createObjectStore('moods', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('bookmarks')) {
          const bs = db.createObjectStore('bookmarks', { keyPath: 'id' })
          bs.createIndex('by-date', 'savedAt')
        }
      },
    })
    await v14.put('moods', { id: 'm1', name: 'アート', color: '#ff0', order: 0, createdAt: 1000 })
    await v14.put('moods', { id: 'm2', name: '音楽', color: '#0ff', order: 1, createdAt: 2000 })
    v14.close()

    // initDB() walks the v14 → v15 upgrade block.
    const v15 = await initDB()
    const tags = await v15.getAll('tags')
    expect(tags).toHaveLength(2)

    const art = tags.find((t: TagRecord) => t.name === 'アート')
    expect(art).toBeDefined()
    expect(art!.color).toBe('#ff0')
    expect(art!.order).toBe(0)
    expect(art!.createdAt).toBe(1000)
    expect(art!.updatedAt).toBe(1000) // seeded from createdAt
    expect(art!.theme).toBeNull()

    const music = tags.find((t: TagRecord) => t.name === '音楽')
    expect(music).toBeDefined()
    expect(music!.updatedAt).toBe(2000)
    expect(music!.theme).toBeNull()

    v15.close()
  })

  it('v14 → v15: bookmark.tags 配列は維持 (= 旧 mood id 参照を壊さない)', async () => {
    const v14 = await openDB(DB_NAME, 14, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('moods')) {
          db.createObjectStore('moods', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('bookmarks')) {
          db.createObjectStore('bookmarks', { keyPath: 'id' })
        }
      },
    })
    await v14.put('moods', { id: 'm1', name: 'アート', color: '#ff0', order: 0, createdAt: 1000 })
    await v14.put('bookmarks', {
      id: 'b1',
      url: 'https://example.com',
      title: 't',
      description: '',
      thumbnail: '',
      favicon: '',
      siteName: '',
      type: 'website',
      savedAt: '2026-01-01T00:00:00.000Z',
      ogpStatus: 'fetched',
      tags: ['m1'],
    })
    v14.close()

    const v15 = await initDB()
    const b = await v15.get('bookmarks', 'b1')
    expect(b?.tags).toEqual(['m1']) // legacy reference preserved
    expect(b?.dominantColor).toBeUndefined() // Phase 1: not yet populated
    v15.close()
  })

  it('v14 → v15: bookmark store に by-tag multiEntry index が作られる', async () => {
    const v14 = await openDB(DB_NAME, 14, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('moods')) {
          db.createObjectStore('moods', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('bookmarks')) {
          db.createObjectStore('bookmarks', { keyPath: 'id' })
        }
      },
    })
    v14.close()

    const v15 = await initDB()
    const bookmarkStore = v15.transaction('bookmarks').objectStore('bookmarks')
    expect(bookmarkStore.indexNames.contains('by-tag')).toBe(true)
    v15.close()
  })

  it('既存 user データ (= 200 ブクマ + 10 タグ) で migration が壊れない', async () => {
    const v14 = await openDB(DB_NAME, 14, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('moods')) {
          db.createObjectStore('moods', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('bookmarks')) {
          db.createObjectStore('bookmarks', { keyPath: 'id' })
        }
      },
    })
    for (let i = 0; i < 10; i++) {
      await v14.put('moods', {
        id: `m${i}`,
        name: `tag${i}`,
        color: '#fff',
        order: i,
        createdAt: 1000 + i,
      })
    }
    for (let i = 0; i < 200; i++) {
      await v14.put('bookmarks', {
        id: `b${i}`,
        url: `https://example.com/${i}`,
        title: `t${i}`,
        description: '',
        thumbnail: '',
        favicon: '',
        siteName: '',
        type: 'website',
        savedAt: '2026-01-01T00:00:00.000Z',
        ogpStatus: 'fetched',
        tags: [`m${i % 10}`],
      })
    }
    v14.close()

    const v15 = await initDB()
    const tags = await v15.getAll('tags')
    const bookmarks = await v15.getAll('bookmarks')
    expect(tags).toHaveLength(10)
    expect(bookmarks).toHaveLength(200)

    // Spot check: a sample bookmark still carries its tag reference.
    const sample = bookmarks.find((b: BookmarkRecord) => b.id === 'b42')
    expect(sample?.tags).toEqual(['m2']) // 42 % 10 = 2
    v15.close()
  })

  it('v15 cold start (= v0 から直接 v15): tags / bookmarks 両 store が作られる、 全部空', async () => {
    // No pre-seeded DB — initDB() runs every upgrade block from v0 → v15.
    const v15 = await initDB()
    const tags = await v15.getAll('tags')
    const bookmarks = await v15.getAll('bookmarks')
    expect(tags).toEqual([])
    expect(bookmarks).toEqual([])

    // by-tag index must exist on cold install too.
    const bookmarkStore = v15.transaction('bookmarks').objectStore('bookmarks')
    expect(bookmarkStore.indexNames.contains('by-tag')).toBe(true)
    v15.close()
  })

  it('v15 already (= idempotent): 再度 initDB() しても変化なし', async () => {
    // First call = cold start, reaches v15.
    const first = await initDB()
    await first.put('tags', {
      id: 't1',
      name: 'x',
      color: '#fff',
      order: 0,
      createdAt: 1,
      updatedAt: 1,
      theme: null,
    })
    first.close()

    // Second call = already at v15; upgrade callback is not invoked.
    const second = await initDB()
    const tags = await second.getAll('tags')
    expect(tags).toHaveLength(1) // data preserved
    expect(tags[0].name).toBe('x')
    second.close()
  })
})
