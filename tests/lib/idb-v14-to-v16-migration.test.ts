import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { initDB } from '@/lib/storage/indexeddb'
import { DB_NAME } from '@/lib/constants'

/**
 * End-to-end migration test for a user who last opened the app at schema v14
 * and now lands on v16 (audit rank38). Exercises the whole chain in one open:
 *   - v14→v15: `moods` store copied into a new `tags` store (updatedAt seeded
 *     from createdAt, theme defaulted to null) + a `by-tag` multiEntry index on
 *     bookmarks.
 *   - v15→v16: BoardConfig.activeFilter migrated from the legacy string form
 *     (`mood:<id>`) to the object form ({ kind: 'tags', tagIds, mode }).
 */
describe('IDB v14 → v16 migration (rank38)', () => {
  beforeEach(async () => {
    const databases = await indexedDB.databases()
    for (const dbInfo of databases) {
      if (dbInfo.name) indexedDB.deleteDatabase(dbInfo.name)
    }
  })

  async function seedV14(): Promise<void> {
    const v14 = await openDB(DB_NAME, 14, {
      upgrade(db) {
        db.createObjectStore('bookmarks', { keyPath: 'id' })
        db.createObjectStore('moods', { keyPath: 'id' })
        db.createObjectStore('cards', { keyPath: 'id' })
        db.createObjectStore('settings', { keyPath: 'key' })
        db.createObjectStore('preferences', { keyPath: 'key' })
      },
    })
    // A legacy mood (no updatedAt / theme — those arrive in v15).
    await v14.put('moods', {
      id: 'm1',
      name: 'Inspiration',
      color: '#28F100',
      order: 0,
      createdAt: 1_700_000_000_000,
    })
    // A bookmark already tagged with that mood id.
    await v14.put('bookmarks', {
      id: 'b1',
      url: 'https://example.com',
      title: 't',
      description: '',
      thumbnail: '',
      favicon: '',
      siteName: '',
      type: 'website',
      savedAt: new Date().toISOString(),
      ogpStatus: 'fetched',
      tags: ['m1'],
    })
    // A board-config carrying the legacy string activeFilter form.
    await v14.put('settings', {
      key: 'board-config',
      config: { activeFilter: 'mood:m1' },
    })
    v14.close()
  }

  it('copies moods → tags, seeding updatedAt + theme', async () => {
    await seedV14()
    const db = await initDB()
    const tag = await db.get('tags', 'm1')
    expect(tag).toBeDefined()
    expect(tag?.name).toBe('Inspiration')
    // updatedAt seeded from createdAt; theme defaulted to null.
    expect((tag as { updatedAt?: number }).updatedAt).toBe(1_700_000_000_000)
    expect((tag as { theme?: unknown }).theme).toBeNull()
    // moods store kept in place for rollback safety.
    const legacy = await db.get('moods', 'm1')
    expect(legacy).toBeDefined()
    db.close()
  })

  it('creates a working by-tag index on bookmarks', async () => {
    await seedV14()
    const db = await initDB()
    const tagged = await db.getAllFromIndex('bookmarks', 'by-tag', 'm1')
    expect(tagged.map((b) => b.id)).toEqual(['b1'])
    // A tag nobody has returns nothing.
    const none = await db.getAllFromIndex('bookmarks', 'by-tag', 'no-such-tag')
    expect(none).toHaveLength(0)
    db.close()
  })

  it('migrates activeFilter string → object form', async () => {
    await seedV14()
    const db = await initDB()
    const cfg = await db.get('settings', 'board-config')
    const filter = (cfg as { config?: { activeFilter?: unknown } }).config?.activeFilter
    expect(filter).toEqual({ kind: 'tags', tagIds: ['m1'], mode: 'and' })
    db.close()
  })

  it('preserves the existing bookmark across the upgrade', async () => {
    await seedV14()
    const db = await initDB()
    const b = await db.get('bookmarks', 'b1')
    expect(b?.url).toBe('https://example.com')
    expect(b?.tags).toEqual(['m1'])
    db.close()
  })
})
