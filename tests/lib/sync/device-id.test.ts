import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { openDB, type IDBPDatabase } from 'idb'
import { getDeviceId } from '@/lib/sync/device-id'

/* eslint-disable @typescript-eslint/no-explicit-any */
type TestDb = IDBPDatabase<any>
const TEST_DB = 'allmarks-test-device-id'

async function makeDb(): Promise<TestDb> {
  return openDB(TEST_DB, 1, {
    upgrade(db) { db.createObjectStore('settings', { keyPath: 'key' }) },
  })
}

describe('getDeviceId', () => {
  let db: TestDb
  beforeEach(async () => {
    const dbs = await indexedDB.databases()
    for (const i of dbs) if (i.name) indexedDB.deleteDatabase(i.name)
    db = await makeDb()
  })
  afterEach(() => db.close())

  it('generates and persists a UUID on first call', async () => {
    const id = await getDeviceId(db as any)
    expect(id).toMatch(/^[0-9a-f-]{36}$/i)
    const rec = await db.get('settings', 'sync-device-id')
    expect(rec.id).toBe(id)
  })

  it('returns the same id on subsequent calls', async () => {
    const a = await getDeviceId(db as any)
    const b = await getDeviceId(db as any)
    expect(b).toBe(a)
  })

  it('honors an id already in the store', async () => {
    await db.put('settings', { key: 'sync-device-id', id: 'preexisting-uuid' })
    expect(await getDeviceId(db as any)).toBe('preexisting-uuid')
  })

  it('serializes concurrent calls on fresh db', async () => {
    const ids = await Promise.all([
      getDeviceId(db as any),
      getDeviceId(db as any),
      getDeviceId(db as any),
      getDeviceId(db as any),
      getDeviceId(db as any),
    ])
    // all 5 concurrent calls should return the same id
    expect(ids[0]).toBe(ids[1])
    expect(ids[1]).toBe(ids[2])
    expect(ids[2]).toBe(ids[3])
    expect(ids[3]).toBe(ids[4])
    // persisted value matches what all calls returned
    const persisted = await db.get('settings', 'sync-device-id')
    expect(persisted.id).toBe(ids[0])
  })
})
