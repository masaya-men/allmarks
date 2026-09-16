import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import type { IDBPDatabase } from 'idb'
import { initDB } from '@/lib/storage/indexeddb'
import { saveSyncTokens, loadSyncTokens, clearSyncTokens, loadSyncStatus, updateSyncStatus, saveBaseSnapshot, loadBaseSnapshot, pushBackupGeneration, loadBackupGenerations } from './sync-store'
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
