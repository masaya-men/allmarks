import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import type { IDBPDatabase } from 'idb'
import { initDB } from '@/lib/storage/indexeddb'
import { DB_VERSION } from '@/lib/constants'
import {
  exportAllStores,
  importAllStores,
  BackupImportError,
} from '@/lib/storage/backup'

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

  // ── rank3: restore must never destroy data with a partial/foreign file ──

  const aBookmark = (id: string): Record<string, unknown> => ({
    id, url: `https://${id}.com`, title: id, description: '',
    thumbnail: '', favicon: '', siteName: id, type: 'website',
    savedAt: '2026-05-25T00:00:00Z', ogpStatus: 'fetched', tags: [],
  })

  it('rejects a backup whose version is newer than the running app (forward-incompat)', async () => {
    const d = await initDB()
    db = d as unknown as IDBPDatabase<unknown>
    await d.put('bookmarks', aBookmark('bm-keep'))

    const dump = { ...(await exportAllStores(d)), version: DB_VERSION + 1, bookmarks: [aBookmark('bm-new')] }

    await expect(importAllStores(d, dump)).rejects.toBeInstanceOf(BackupImportError)
    // Existing data untouched — the reject happens before any clear().
    const after = await d.getAll('bookmarks')
    expect(after.map((b) => (b as { id: string }).id)).toEqual(['bm-keep'])
  })

  it('refuses a backup that has zero bookmarks, leaving the current DB intact', async () => {
    const d = await initDB()
    db = d as unknown as IDBPDatabase<unknown>
    await d.put('bookmarks', aBookmark('bm-keep'))

    const dump = { ...(await exportAllStores(d)), bookmarks: [] as Record<string, unknown>[] }

    await expect(importAllStores(d, dump)).rejects.toBeInstanceOf(BackupImportError)
    const after = await d.getAll('bookmarks')
    expect(after.map((b) => (b as { id: string }).id)).toEqual(['bm-keep'])
  })

  it('does NOT clear a store the dump leaves empty (= partial file cannot wipe placement)', async () => {
    const d = await initDB()
    db = d as unknown as IDBPDatabase<unknown>
    await d.put('bookmarks', aBookmark('bm-old'))
    await d.put('tags', { id: 'tag-keep', name: 'Keep', color: '#28F100', order: 0, createdAt: 0 })

    // A valid backup of new bookmarks, but with tags omitted (empty array).
    const dump = { ...(await exportAllStores(d)), bookmarks: [aBookmark('bm-new')], tags: [] as Record<string, unknown>[] }

    await importAllStores(d, dump)

    // bookmarks fully replaced...
    const bms = await d.getAll('bookmarks')
    expect(bms.map((b) => (b as { id: string }).id)).toEqual(['bm-new'])
    // ...but the existing tag survives (empty store in dump = leave untouched).
    const tags = await d.getAll('tags')
    expect(tags.map((t) => (t as { id: string }).id)).toEqual(['tag-keep'])
  })

  it('reports imported counts and lists skipped stores that retained existing data', async () => {
    const d = await initDB()
    db = d as unknown as IDBPDatabase<unknown>
    await d.put('tags', { id: 'tag-keep', name: 'Keep', color: '#28F100', order: 0, createdAt: 0 })
    const dump = { ...(await exportAllStores(d)), bookmarks: [aBookmark('bm-1'), aBookmark('bm-2')], tags: [] as Record<string, unknown>[] }

    const result = await importAllStores(d, dump)

    expect(result.imported.bookmarks).toBe(2)
    // tags was empty in the dump but the DB still holds tag-keep → surfaced.
    expect(result.skipped).toContain('tags')
  })

  it('does NOT list a skipped store that was already empty (nothing stale to report)', async () => {
    const d = await initDB()
    db = d as unknown as IDBPDatabase<unknown>
    // Fresh DB: no tags/cards/etc. Dump replaces bookmarks only.
    const dump = { ...(await exportAllStores(d)), bookmarks: [aBookmark('bm-1')], tags: [] as Record<string, unknown>[] }

    const result = await importAllStores(d, dump)

    expect(result.skipped).toEqual([])
  })

  it('a runtime put failure in a later store rolls back ALL stores (cross-store atomic)', async () => {
    const d = await initDB()
    db = d as unknown as IDBPDatabase<unknown>
    await d.put('bookmarks', aBookmark('bm-keep'))

    // bookmarks rows are fine; a tag row carries its key (passes up-front
    // validation) but holds a non-cloneable value, so put() throws at runtime
    // AFTER bookmarks would have been cleared. A single cross-store transaction
    // must roll bookmarks back too, leaving bm-keep intact (not bm-new).
    const dump = {
      ...(await exportAllStores(d)),
      bookmarks: [aBookmark('bm-new')],
      tags: [{ id: 'tag-bad', boom: () => 1 } as unknown as Record<string, unknown>],
    }

    await expect(importAllStores(d, dump)).rejects.toBeTruthy()
    const after = await d.getAll('bookmarks')
    expect(after.map((b) => (b as { id: string }).id)).toEqual(['bm-keep'])
  })

  it('a malformed row in a store does not leave that store half-wiped (atomic per store)', async () => {
    const d = await initDB()
    db = d as unknown as IDBPDatabase<unknown>
    await d.put('bookmarks', aBookmark('bm-keep'))

    // First bookmark is valid, second is missing the keyPath ('id') => put rejects
    // mid-loop. The store's clear()+put() share one transaction, so the failure
    // must roll the clear() back: bm-keep survives rather than being lost.
    const dump = {
      ...(await exportAllStores(d)),
      bookmarks: [aBookmark('bm-new'), { url: 'https://no-id.com' } as Record<string, unknown>],
    }

    await expect(importAllStores(d, dump)).rejects.toBeTruthy()
    const after = await d.getAll('bookmarks')
    expect(after.map((b) => (b as { id: string }).id)).toEqual(['bm-keep'])
  })
})
