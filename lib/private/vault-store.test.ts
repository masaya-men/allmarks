import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { openDB, type IDBPDatabase } from 'idb'
import { loadVaultRecord, createVault, unlockVault, changeVaultPassword } from './vault-store'
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
    expect(session).toEqual({ tagId: 'tag-abc', privateKey: expect.anything(), wrappingKey: expect.anything() })
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

  it("createVault's session.wrappingKey can decrypt the stored wrappedPrivateKey directly", async () => {
    const { decryptJson } = await import('./crypto')
    const session = await createVault(db, 'tag-abc', 'hunter2')
    const record = await loadVaultRecord(db)
    const { pkcs8 } = await decryptJson<{ pkcs8: string }>(
      session.wrappingKey, record!.wrappedPrivateKey.iv, record!.wrappedPrivateKey.ciphertext,
    )
    expect(typeof pkcs8).toBe('string')
    expect(pkcs8.length).toBeGreaterThan(0)
  })

  it('unlockVault returns a session with a wrappingKey too', async () => {
    await createVault(db, 'tag-abc', 'hunter2')
    const session = await unlockVault(db, 'hunter2')
    expect(session?.wrappingKey).toBeDefined()
  })

  describe('changeVaultPassword', () => {
    it('changes the password: old password no longer unlocks, new password does', async () => {
      const session = await createVault(db, 'tag-abc', 'old-password123')
      const result = await changeVaultPassword(db, session, 'new-password456', undefined)
      expect(result.ok).toBe(true)
      expect(await unlockVault(db, 'old-password123')).toBeNull()
      expect(await unlockVault(db, 'new-password456')).not.toBeNull()
    })

    it('the same private key still decrypts data encrypted before the password change', async () => {
      const session = await createVault(db, 'tag-abc', 'old-password123')
      const record = await loadVaultRecord(db)
      const publicKey = await importPublicKey(record!.publicKey)
      const envelope = await encryptWithPublicKey(publicKey, { secret: 'hello' })

      const result = await changeVaultPassword(db, session, 'new-password456', undefined)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('unreachable')

      await expect(decryptWithPrivateKey(result.session.privateKey, envelope)).resolves.toEqual({ secret: 'hello' })
    })

    it('stamps updatedAt, rotates the salt, and keeps publicKey/tagId unchanged', async () => {
      const session = await createVault(db, 'tag-abc', 'old-password123')
      const before = await loadVaultRecord(db)
      await changeVaultPassword(db, session, 'new-password456', undefined)
      const after = await loadVaultRecord(db)
      expect(after!.salt).not.toBe(before!.salt)
      expect(after!.wrappedPrivateKey.ciphertext).not.toBe(before!.wrappedPrivateKey.ciphertext)
      expect(after!.publicKey).toBe(before!.publicKey)
      expect(after!.tagId).toBe(before!.tagId)
      expect(typeof after!.updatedAt).toBe('number')
    })

    it('updates the hint when a new one is passed, clears it when undefined', async () => {
      const session = await createVault(db, 'tag-abc', 'old-password123', 'old hint')
      const result = await changeVaultPassword(db, session, 'new-password456', 'new hint')
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('unreachable')
      expect((await loadVaultRecord(db))!.hint).toBe('new hint')

      const result2 = await changeVaultPassword(db, result.session, 'newer-password789', undefined)
      expect(result2.ok).toBe(true)
      expect((await loadVaultRecord(db))!.hint).toBeUndefined()
    })

    it('returns ok:false when no vault record exists', async () => {
      const session = await createVault(db, 'tag-abc', 'password123')
      await db.delete('settings', 'private-vault')
      const result = await changeVaultPassword(db, session, 'new-password', undefined)
      expect(result.ok).toBe(false)
    })
  })
})
