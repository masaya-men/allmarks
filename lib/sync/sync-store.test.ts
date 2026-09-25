import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import type { IDBPDatabase } from 'idb'
import { initDB } from '@/lib/storage/indexeddb'
import { saveSyncTokens, loadSyncTokens, clearSyncTokens, loadSyncStatus, updateSyncStatus, saveBaseSnapshot, loadBaseSnapshot, pushBackupGeneration, loadBackupGenerations, loadRemoteCache, saveRemoteCache, patchRemoteCache } from './sync-store'
import { DEVICE_LOCAL_SETTINGS_KEYS, exportAllStores } from '@/lib/storage/backup'
import type { SyncTokens } from './auth'
import type { SyncSnapshot } from './merge'

let db: IDBPDatabase<unknown> | null = null

beforeEach(async () => {
  const databases = await indexedDB.databases()
  for (const info of databases) { if (info.name) indexedDB.deleteDatabase(info.name) }
})
afterEach(() => { if (db) { db.close(); db = null } })

describe('sync-store tokens', () => {
  it('returns null when nothing saved', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    expect(await loadSyncTokens(d)).toBeNull()
  })

  it('round-trips saved tokens', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const tokens: SyncTokens = { accessToken: 'at', expiresAt: 12345, scope: 'drive.file', refreshToken: 'rt', idToken: 'idt' }
    await saveSyncTokens(d, tokens)
    expect(await loadSyncTokens(d)).toEqual(tokens)
  })

  it('a later save without refreshToken does not resurrect the old one (overwrite, not merge)', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await saveSyncTokens(d, { accessToken: 'at1', expiresAt: 1, scope: 's', refreshToken: 'rt' })
    await saveSyncTokens(d, { accessToken: 'at2', expiresAt: 2, scope: 's' })
    const loaded = await loadSyncTokens(d)
    expect(loaded?.accessToken).toBe('at2')
    expect(loaded?.refreshToken).toBeUndefined()
  })

  it('clearSyncTokens removes stored tokens', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await saveSyncTokens(d, { accessToken: 'at', expiresAt: 1, scope: 's' })
    await clearSyncTokens(d)
    expect(await loadSyncTokens(d)).toBeNull()
  })
})

const EMPTY_SNAPSHOT: SyncSnapshot = { bookmarks: [], tags: [], cards: [], boardConfig: null, vault: null }

describe('sync-store status', () => {
  it('returns a disconnected default when nothing saved', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    expect(await loadSyncStatus(d)).toEqual({ connected: false, headRevisions: {} })
  })

  it('updateSyncStatus merges headRevisions instead of replacing them', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await updateSyncStatus(d, { connected: true, folderId: 'f1', headRevisions: { 'bookmarks.json': 'r1' } })
    const status = await updateSyncStatus(d, { headRevisions: { 'tags.json': 'r2' } })
    expect(status.headRevisions).toEqual({ 'bookmarks.json': 'r1', 'tags.json': 'r2' })
    expect(status.connected).toBe(true)
    expect(status.folderId).toBe('f1')
  })

  it('updateSyncStatus overwrites a headRevisions key when the same file name is patched again', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await updateSyncStatus(d, { headRevisions: { 'bookmarks.json': 'r1' } })
    const status = await updateSyncStatus(d, { headRevisions: { 'bookmarks.json': 'r2' } })
    expect(status.headRevisions).toEqual({ 'bookmarks.json': 'r2' })
  })

  it('round-trips connectedEmail and lastIssue', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await updateSyncStatus(d, { connected: true, connectedEmail: 'user@example.com' })
    const status = await updateSyncStatus(d, { lastIssue: { kind: 'error', errorKind: 'auth' } })
    expect(status.connectedEmail).toBe('user@example.com')
    expect(status.lastIssue).toEqual({ kind: 'error', errorKind: 'auth' })
  })

  it('a later patch can explicitly clear lastIssue back to undefined', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await updateSyncStatus(d, { lastIssue: { kind: 'needs-confirmation', deletedCount: 5 } })
    const status = await updateSyncStatus(d, { lastIssue: undefined })
    expect(status.lastIssue).toBeUndefined()
  })
})

describe('sync-store base snapshot + backups', () => {
  it('loadBaseSnapshot returns null when nothing saved', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    expect(await loadBaseSnapshot(d)).toBeNull()
  })

  it('round-trips a base snapshot', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await saveBaseSnapshot(d, EMPTY_SNAPSHOT)
    expect(await loadBaseSnapshot(d)).toEqual(EMPTY_SNAPSHOT)
  })

  it('pushBackupGeneration keeps only the newest 3, newest first', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    for (let i = 0; i < 4; i++) {
      await pushBackupGeneration(d, { ...EMPTY_SNAPSHOT, boardConfig: { config: {} as never, updatedAt: i } })
    }
    const generations = await loadBackupGenerations(d)
    expect(generations).toHaveLength(3)
    expect(generations[0].snapshot.boardConfig?.updatedAt).toBe(3)
    expect(generations[2].snapshot.boardConfig?.updatedAt).toBe(1)
  })
})

describe('sync-store remote file cache (sync format v2)', () => {
  it('is empty by default', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    expect(await loadRemoteCache(d, 'folder1')).toEqual({})
  })

  it('round-trips, scoped to the folder it was saved for', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await saveRemoteCache(d, 'folder1', { 'bookmarks-0.json.gz': { rev: 'r1', text: '[]' } })
    expect(await loadRemoteCache(d, 'folder1')).toEqual({ 'bookmarks-0.json.gz': { rev: 'r1', text: '[]' } })
    expect(await loadRemoteCache(d, 'other-folder')).toEqual({})
  })

  it('patchRemoteCache adds/replaces/removes entries and keeps the rest', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await saveRemoteCache(d, 'folder1', {
      'a.json.gz': { rev: 'r1', text: '1' },
      'b.json.gz': { rev: 'r1', text: '2' },
    })
    await patchRemoteCache(d, 'folder1', { 'a.json.gz': { rev: 'r2', text: '1b' }, 'b.json.gz': null, 'c.json.gz': { rev: 'r1', text: '3' } })
    expect(await loadRemoteCache(d, 'folder1')).toEqual({
      'a.json.gz': { rev: 'r2', text: '1b' },
      'c.json.gz': { rev: 'r1', text: '3' },
    })
  })

  it('patchRemoteCache for a different folder starts from an empty cache', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await saveRemoteCache(d, 'folder1', { 'a.json.gz': { rev: 'r1', text: '1' } })
    await patchRemoteCache(d, 'folder2', { 'x.json.gz': { rev: 'r9', text: '9' } })
    expect(await loadRemoteCache(d, 'folder2')).toEqual({ 'x.json.gz': { rev: 'r9', text: '9' } })
    expect(await loadRemoteCache(d, 'folder1')).toEqual({})
  })

  it('is device-local: listed in DEVICE_LOCAL_SETTINGS_KEYS and left out of a backup export', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    expect(DEVICE_LOCAL_SETTINGS_KEYS).toContain('sync-remote-cache')
    await saveRemoteCache(d, 'folder1', { 'a.json.gz': { rev: 'r1', text: '1' } })
    const backup = await exportAllStores(d)
    const keys = backup.settings.map((row) => (row as { key?: unknown }).key)
    expect(keys).not.toContain('sync-remote-cache')
  })
})
