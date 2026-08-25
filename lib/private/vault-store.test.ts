import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { openDB, type IDBPDatabase } from 'idb'
import { loadVaultRecord, createVault, unlockVault } from './vault-store'
import { importPublicKey, encryptWithPublicKey, decryptWithPrivateKey } from './crypto'

const TEST_DB = 'allmarks-test-private-vault-store'

/* eslint-disable @typescript-eslint/no-explicit-any */
type TestDb = IDBPDatabase<any>

async function makeDb(): Promise<TestDb> {
  return await openDB(TEST_DB, 1, {
    upgrade(db) {
      db.createObjectStore('settings', { keyPath: 'key' })
    },
  })
}

describe('private/vault-store', () => {
  let db: TestDb

  beforeEach(async () => {
    const databases = await indexedDB.databases()
    for (const info of databases) {
      if (info.name) indexedDB.deleteDatabase(info.name)
    }
    db = await makeDb()
  })

  afterEach(() => {
    db.close()
  })

  it('loadVaultRecord returns null before any vault exists', async () => {
    expect(await loadVaultRecord(db)).toBeNull()
  })

  it('createVault persists a record (with a public key, no plaintext secret) and returns an unlocked session', async () => {
    const session = await createVault(db, 'tag-abc', 'hunter2', 'my hint')
    expect(session).toEqual({ tagId: 'tag-abc', privateKey: expect.anything() })
    const record = await loadVaultRecord(db)
    expect(record?.tagId).toBe('tag-abc')
    expect(record?.hint).toBe('my hint')
    expect(record?.salt.length).toBeGreaterThan(0)
    expect(record?.publicKey.length).toBeGreaterThan(0)
    expect(record?.wrappedPrivateKey.iv.length).toBeGreaterThan(0)
    expect(record?.wrappedPrivateKey.ciphertext.length).toBeGreaterThan(0)
  })

  it('unlockVault with the right password returns a session with the same tagId', async () => {
    await createVault(db, 'tag-abc', 'hunter2')
    const session = await unlockVault(db, 'hunter2')
    expect(session?.tagId).toBe('tag-abc')
  })

  it('unlockVault with the wrong password returns null (not a thrown error)', async () => {
    await createVault(db, 'tag-abc', 'hunter2')
    const session = await unlockVault(db, 'not-the-password')
    expect(session).toBeNull()
  })

  it('unlockVault before any vault exists returns null', async () => {
    const session = await unlockVault(db, 'anything')
    expect(session).toBeNull()
  })

  it("createVault's public key can encrypt data that a later unlockVault session can decrypt", async () => {
    await createVault(db, 'tag-abc', 'hunter2')
    const record = await loadVaultRecord(db)
    const publicKey = await importPublicKey(record!.publicKey)
    const envelope = await encryptWithPublicKey(publicKey, { secret: 'hello' })
    const session = await unlockVault(db, 'hunter2')
    await expect(decryptWithPrivateKey(session!.privateKey, envelope)).resolves.toEqual({ secret: 'hello' })
  })
})
