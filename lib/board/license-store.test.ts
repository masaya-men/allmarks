import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import type { IDBPDatabase } from 'idb'
import { initDB } from '@/lib/storage/indexeddb'
import { saveLicense, loadLicense, clearLicense, type LicenseState } from './license-store'

let db: IDBPDatabase<unknown> | null = null

beforeEach(async () => {
  const databases = await indexedDB.databases()
  for (const info of databases) { if (info.name) indexedDB.deleteDatabase(info.name) }
})
afterEach(() => { if (db) { db.close(); db = null } })

describe('license-store', () => {
  it('returns null when nothing saved', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    expect(await loadLicense(d)).toBeNull()
  })

  it('round-trips a saved license', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const state: LicenseState = { kid: 'kid-1', deviceId: 'device-1', scope: ['sync'], validatedAt: 1_780_000_000_000 }
    await saveLicense(d, state)
    expect(await loadLicense(d)).toEqual(state)
  })

  it('a later save overwrites the previous license (not merged)', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await saveLicense(d, { kid: 'kid-1', deviceId: 'device-1', scope: ['sync'], validatedAt: 1 })
    await saveLicense(d, { kid: 'kid-2', deviceId: 'device-1', scope: ['sync'], validatedAt: 2 })
    const loaded = await loadLicense(d)
    expect(loaded?.kid).toBe('kid-2')
  })

  it('clearLicense removes the stored license', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await saveLicense(d, { kid: 'kid-1', deviceId: 'device-1', scope: ['sync'], validatedAt: 1 })
    await clearLicense(d)
    expect(await loadLicense(d)).toBeNull()
  })
})
