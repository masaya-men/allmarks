import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import type { IDBPDatabase } from 'idb'
import { initDB, type AllMarksDB } from '@/lib/storage/indexeddb'
import { saveBoardConfig } from '@/lib/storage/board-config'
import { createVault } from '@/lib/private/vault-store'
import { buildLocalSnapshot, applySnapshotToLocal } from './engine'
import type { SyncSnapshot } from './merge'

let db: IDBPDatabase<AllMarksDB> | null = null

beforeEach(async () => {
  const databases = await indexedDB.databases()
  for (const info of databases) { if (info.name) indexedDB.deleteDatabase(info.name) }
})
afterEach(() => { if (db) { db.close(); db = null } })

describe('buildLocalSnapshot', () => {
  it('returns empty arrays and nulls on a fresh DB', async () => {
    const d = await initDB(); db = d
    const snapshot = await buildLocalSnapshot(d)
    expect(snapshot).toEqual({ bookmarks: [], tags: [], cards: [], boardConfig: null, vault: null })
  })

  it('includes board config with updatedAt and vault when present', async () => {
    const d = await initDB(); db = d
    await saveBoardConfig(d, { themeId: 'dotted-notebook' } as never, 42)
    await createVault(d, 'tag1', 'password123', undefined)
    const snapshot = await buildLocalSnapshot(d)
    expect(snapshot.boardConfig?.updatedAt).toBe(42)
    expect(snapshot.vault?.tagId).toBe('tag1')
  })
})

describe('applySnapshotToLocal', () => {
  it('adds new bookmarks/tags/cards without touching unrelated existing rows', async () => {
    const d = await initDB(); db = d
    await d.put('bookmarks', {
      id: 'existing', url: 'https://a.com', title: 'a', description: '', thumbnail: '', favicon: '',
      siteName: '', type: 'website', savedAt: '2026-01-01T00:00:00.000Z', ogpStatus: 'fetched', tags: [],
    } as never)

    const snapshot: SyncSnapshot = {
      bookmarks: [{
        id: 'new', url: 'https://b.com', title: 'b', description: '', thumbnail: '', favicon: '',
        siteName: '', type: 'website', savedAt: '2026-01-02T00:00:00.000Z', ogpStatus: 'fetched', tags: [],
      } as never],
      tags: [], cards: [], boardConfig: null, vault: null,
    }
    await applySnapshotToLocal(d, snapshot)

    const all = await d.getAll('bookmarks')
    expect(all.map(b => b.id).sort()).toEqual(['existing', 'new'])
  })

  it('leaves settings untouched when boardConfig/vault are null in the snapshot', async () => {
    const d = await initDB(); db = d
    await saveBoardConfig(d, { themeId: 'flat' } as never, 1)
    const snapshot: SyncSnapshot = { bookmarks: [], tags: [], cards: [], boardConfig: null, vault: null }
    await applySnapshotToLocal(d, snapshot)
    const record = await d.get('settings', 'board-config')
    expect((record as { updatedAt?: number } | undefined)?.updatedAt).toBe(1)
  })

  it('writes boardConfig and vault when present in the snapshot', async () => {
    const d = await initDB(); db = d
    const snapshot: SyncSnapshot = {
      bookmarks: [], tags: [], cards: [],
      boardConfig: { config: { themeId: 'flat' } as never, updatedAt: 7 },
      vault: {
        key: 'private-vault', tagId: 'tag1', salt: 's', iterations: 600000,
        publicKey: 'pk', wrappedPrivateKey: { iv: 'iv', ciphertext: 'ct' },
      },
    }
    await applySnapshotToLocal(d, snapshot)
    const config = await d.get('settings', 'board-config')
    expect((config as { updatedAt?: number } | undefined)?.updatedAt).toBe(7)
    const vault = await d.get('settings', 'private-vault')
    expect((vault as { tagId?: string } | undefined)?.tagId).toBe('tag1')
  })
})
