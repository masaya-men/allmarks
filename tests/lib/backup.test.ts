import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import type { IDBPDatabase } from 'idb'
import { initDB } from '@/lib/storage/indexeddb'
import { exportAllStores, importAllStores } from '@/lib/storage/backup'

let db: IDBPDatabase<unknown> | null = null

beforeEach(async () => {
  const databases = await indexedDB.databases()
  for (const info of databases) {
    if (info.name) indexedDB.deleteDatabase(info.name)
  }
})
afterEach(() => { if (db) { db.close(); db = null } })

describe('backup', () => {
  it('exports bookmarks / tags / settings as JSON', async () => {
    const d = await initDB()
    db = d as unknown as IDBPDatabase<unknown>
    await d.put('bookmarks', {
      id: 'bm-1', url: 'https://example.com', title: 't', description: '',
      thumbnail: '', favicon: '', siteName: 'Example', type: 'website',
      savedAt: '2026-05-25T00:00:00Z', ogpStatus: 'fetched', tags: [],
    })
    await d.put('tags', {
      id: 'tag-1', name: 'Music', color: '#28F100', createdAt: '2026-05-25T00:00:00Z',
    })
    await d.put('settings', { key: 'board-config', config: { activeFilter: 'all' } })

    const json = await exportAllStores(d)

    expect(json.version).toBeGreaterThanOrEqual(15)
    expect(json.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(json.bookmarks).toHaveLength(1)
    expect((json.bookmarks[0] as { id: string }).id).toBe('bm-1')
    expect(json.tags).toHaveLength(1)
    expect((json.tags[0] as { id: string }).id).toBe('tag-1')
    expect(json.settings).toHaveLength(1)
  })

  it('imports JSON and restores all stores', async () => {
    const d1 = await initDB()
    db = d1 as unknown as IDBPDatabase<unknown>
    await d1.put('bookmarks', {
      id: 'bm-x', url: 'https://x.com', title: 'X', description: '',
      thumbnail: '', favicon: '', siteName: 'X', type: 'website',
      savedAt: '2026-05-25T00:00:00Z', ogpStatus: 'fetched', tags: [],
    })
    const dump = await exportAllStores(d1)
    d1.close()
    db = null

    // wipe + reimport
    indexedDB.deleteDatabase('booklage-db')
    const d2 = await initDB()
    db = d2 as unknown as IDBPDatabase<unknown>
    await importAllStores(d2, dump)

    const restored = await d2.getAll('bookmarks')
    expect(restored).toHaveLength(1)
    expect((restored[0] as { id: string }).id).toBe('bm-x')
  })

  it('importAllStores wipes existing rows before restore (= avoid id collision)', async () => {
    const d = await initDB()
    db = d as unknown as IDBPDatabase<unknown>
    await d.put('bookmarks', {
      id: 'bm-a', url: 'https://a.com', title: 'A', description: '',
      thumbnail: '', favicon: '', siteName: 'A', type: 'website',
      savedAt: '2026-05-25T00:00:00Z', ogpStatus: 'fetched', tags: [],
    })
    const dump = await exportAllStores(d)

    // Add a different row in the current DB, then import the dump.
    await d.put('bookmarks', {
      id: 'bm-b', url: 'https://b.com', title: 'B', description: '',
      thumbnail: '', favicon: '', siteName: 'B', type: 'website',
      savedAt: '2026-05-25T00:00:00Z', ogpStatus: 'fetched', tags: [],
    })
    await importAllStores(d, dump)

    // Only bm-a should remain (= import is a full replace, not merge).
    const after = await d.getAll('bookmarks')
    expect(after.map((b) => (b as { id: string }).id)).toEqual(['bm-a'])
  })
})
