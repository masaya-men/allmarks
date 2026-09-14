import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import type { IDBPDatabase } from 'idb'
import { initDB } from '@/lib/storage/indexeddb'
import { saveSyncTokens, loadSyncTokens, clearSyncTokens } from './sync-store'
import type { SyncTokens } from './auth'

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
