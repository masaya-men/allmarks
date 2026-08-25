import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { openDB, type IDBPDatabase } from 'idb'
import {
  addPrivateTag, removePrivateTag, addPrivateTagBatch, executePrivateAction,
  resolvePrivateStatus, privateActionNeedsUnlock, PRIVATE_DROP_KEY,
} from './apply-tag-change'
import {
  deriveKey, generateSalt, generateEcdhKeyPair, exportPublicKeyB64, wrapPrivateKey, unwrapPrivateKey,
} from './crypto'
import type { PrivateVaultSession } from './vault-session'
import type { BookmarkRecord } from '@/lib/storage/indexeddb'

const TEST_DB = 'allmarks-test-apply-tag-change'

/* eslint-disable @typescript-eslint/no-explicit-any */
type TestDb = IDBPDatabase<any>

async function makeDb(): Promise<TestDb> {
  return await openDB(TEST_DB, 1, {
    upgrade(db) {
      const bs = db.createObjectStore('bookmarks', { keyPath: 'id' })
      bs.createIndex('by-tag', 'tags', { multiEntry: true })
      db.createObjectStore('settings', { keyPath: 'key' })
    },
  })
}

function makeBookmark(id: string, overrides: Partial<BookmarkRecord> = {}): BookmarkRecord {
  return {
    id,
    url: 'https://example.com',
    title: 'My Title',
    description: 'desc',
    thumbnail: 'https://example.com/t.jpg',
    favicon: '',
    siteName: 'Example',
    type: 'website',
    savedAt: new Date().toISOString(),
    ogpStatus: 'fetched',
    tags: [],
    ...overrides,
  } as BookmarkRecord
}

describe('private/apply-tag-change', () => {
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

  /** Puts a real vault record (matching vault-store's shape) directly into
   *  `settings` and returns a matching unlocked session — mirrors what
   *  createVault/unlockVault do, without importing vault-store (keeps this
   *  test file focused on apply-tag-change's own contract). */
  async function makeVault(): Promise<PrivateVaultSession> {
    const salt = generateSalt()
    const wrappingKey = await deriveKey('pw', salt, 1000)
    const keyPair = await generateEcdhKeyPair()
    const publicKey = await exportPublicKeyB64(keyPair.publicKey)
    const wrappedPrivateKey = await wrapPrivateKey(keyPair.privateKey, wrappingKey)
    await db.put('settings', {
      key: 'private-vault',
      tagId: 'private-tag-id',
      salt,
      iterations: 1000,
      publicKey,
      wrappedPrivateKey,
    })
    const privateKey = await unwrapPrivateKey(wrappedPrivateKey, wrappingKey)
    return { tagId: 'private-tag-id', privateKey }
  }

  it('addPrivateTag encrypts the sensitive fields and blanks the plaintext columns', async () => {
    const bookmark = makeBookmark('b1')
    await db.put('bookmarks', bookmark)
    await makeVault()
    await addPrivateTag(db, bookmark.id, 'private-tag-id')
    const updated = await db.get('bookmarks', bookmark.id)
    expect(updated.title).toBe('')
    expect(updated.url).toBe('')
    expect(updated.encryptedPayload).toBeDefined()
    expect(updated.encryptedPayload.ephemeralPublicKey).toBeDefined()
    expect(updated.tags).toContain('private-tag-id')
  })

  it('addPrivateTag is a no-op when no vault has been set up yet', async () => {
    const bookmark = makeBookmark('b0')
    await db.put('bookmarks', bookmark)
    await addPrivateTag(db, bookmark.id, 'private-tag-id')
    const stored = await db.get('bookmarks', bookmark.id)
    expect(stored.encryptedPayload).toBeUndefined()
    expect(stored.tags).not.toContain('private-tag-id')
  })

  it('removePrivateTag decrypts the fields back to plaintext and clears encryptedPayload', async () => {
    const bookmark = makeBookmark('b2', { thumbnail: '' })
    await db.put('bookmarks', bookmark)
    const session = await makeVault()
    await addPrivateTag(db, bookmark.id, 'private-tag-id')
    await removePrivateTag(db, bookmark.id, 'private-tag-id', session)
    const restored = await db.get('bookmarks', bookmark.id)
    expect(restored.title).toBe('My Title')
    expect(restored.url).toBe('https://example.com')
    expect(restored.encryptedPayload).toBeUndefined()
    expect(restored.tags).not.toContain('private-tag-id')
  })

  it('removePrivateTag throws if the vault is locked (session null)', async () => {
    const bookmark = makeBookmark('b3')
    await db.put('bookmarks', bookmark)
    await makeVault()
    await addPrivateTag(db, bookmark.id, 'private-tag-id')
    await expect(removePrivateTag(db, bookmark.id, 'private-tag-id', null)).rejects.toThrow('locked')
  })

  it('addPrivateTag also encrypts photos/mediaSlots and blanks them at rest', async () => {
    const bookmark = makeBookmark('b4', {
      photos: ['https://pbs.twimg.com/a.jpg'],
      mediaSlots: [{ type: 'photo', url: 'https://pbs.twimg.com/a.jpg' }],
    })
    await db.put('bookmarks', bookmark)
    const session = await makeVault()
    await addPrivateTag(db, bookmark.id, 'private-tag-id')
    const updated = await db.get('bookmarks', bookmark.id)
    expect(updated.photos).toBeUndefined()
    expect(updated.mediaSlots).toBeUndefined()

    await removePrivateTag(db, bookmark.id, 'private-tag-id', session)
    const restored = await db.get('bookmarks', bookmark.id)
    expect(restored.photos).toEqual(['https://pbs.twimg.com/a.jpg'])
    expect(restored.mediaSlots).toEqual([{ type: 'photo', url: 'https://pbs.twimg.com/a.jpg' }])
  })

  describe('resolvePrivateStatus', () => {
    it('returns none when no Private tag exists yet', () => {
      expect(resolvePrivateStatus(null, null)).toBe('none')
    })
    it('returns locked when the tag exists but there is no session', () => {
      expect(resolvePrivateStatus('private-tag-id', null)).toBe('locked')
    })
    it('returns unlocked when the tag exists and a session is present', async () => {
      const session = await makeVault()
      expect(resolvePrivateStatus('private-tag-id', session)).toBe('unlocked')
    })
  })

  describe('privateActionNeedsUnlock', () => {
    it('filter always needs unlock', () => {
      expect(privateActionNeedsUnlock({ kind: 'filter' })).toBe(true)
    })
    it('toggle-tag adding (currentlyTagged: false) does not need unlock', () => {
      expect(privateActionNeedsUnlock({ kind: 'toggle-tag', bookmarkId: 'x', currentlyTagged: false })).toBe(false)
    })
    it('toggle-tag removing (currentlyTagged: true) needs unlock', () => {
      expect(privateActionNeedsUnlock({ kind: 'toggle-tag', bookmarkId: 'x', currentlyTagged: true })).toBe(true)
    })
    it('batch-encrypt does not need unlock', () => {
      expect(privateActionNeedsUnlock({ kind: 'batch-encrypt', bookmarkIds: ['x'] })).toBe(false)
    })
  })

  describe('PRIVATE_DROP_KEY', () => {
    it('is a sentinel string, never a valid tag id shape', () => {
      expect(PRIVATE_DROP_KEY).toBe('__private__')
    })
  })

  describe('addPrivateTagBatch', () => {
    it('encrypts every listed bookmark not already Private, without needing a session', async () => {
      await db.put('bookmarks', makeBookmark('b1'))
      await db.put('bookmarks', makeBookmark('b2'))
      await makeVault()
      const result = await addPrivateTagBatch(db, ['b1', 'b2'], 'private-tag-id')
      expect(result.succeeded).toEqual(['b1', 'b2'])
      expect(result.failed).toEqual([])
      const b1 = await db.get('bookmarks', 'b1')
      const b2 = await db.get('bookmarks', 'b2')
      expect(b1.encryptedPayload).toBeDefined()
      expect(b2.encryptedPayload).toBeDefined()
    })

    it('skips (as succeeded, unchanged) a bookmark already carrying the Private tag', async () => {
      const already = makeBookmark('b3', {
        tags: ['private-tag-id'], title: '',
        encryptedPayload: { ephemeralPublicKey: 'e', iv: 'x', ciphertext: 'y' },
      })
      await db.put('bookmarks', already)
      await makeVault()
      const result = await addPrivateTagBatch(db, ['b3'], 'private-tag-id')
      expect(result.succeeded).toEqual(['b3'])
      expect(result.failed).toEqual([])
      const stored = await db.get('bookmarks', 'b3')
      expect(stored.encryptedPayload).toEqual({ ephemeralPublicKey: 'e', iv: 'x', ciphertext: 'y' })
    })

    it('silently skips (neither list) a bookmark id that does not exist', async () => {
      await makeVault()
      const result = await addPrivateTagBatch(db, ['does-not-exist'], 'private-tag-id')
      expect(result.succeeded).toEqual([])
      expect(result.failed).toEqual([])
    })

    it('reports failed ids without throwing when encryption itself fails (corrupted vault record)', async () => {
      await db.put('bookmarks', makeBookmark('b4'))
      await db.put('bookmarks', makeBookmark('b5'))
      await db.put('settings', {
        key: 'private-vault', tagId: 'private-tag-id', salt: 's', iterations: 1000,
        publicKey: 'not-valid-base64-spki', wrappedPrivateKey: { iv: 'x', ciphertext: 'y' },
      })
      const result = await addPrivateTagBatch(db, ['b4', 'b5'], 'private-tag-id')
      expect(result.succeeded).toEqual([])
      expect(result.failed).toEqual(['b4', 'b5'])
    })
  })

  describe('executePrivateAction', () => {
    it('toggle-tag with currentlyTagged: false encrypts the bookmark without needing a session', async () => {
      await db.put('bookmarks', makeBookmark('b6'))
      await makeVault()
      const result = await executePrivateAction(
        db, { kind: 'toggle-tag', bookmarkId: 'b6', currentlyTagged: false }, 'private-tag-id', null,
      )
      expect(result.failed).toEqual([])
      const stored = await db.get('bookmarks', 'b6')
      expect(stored.encryptedPayload).toBeDefined()
    })

    it('toggle-tag with currentlyTagged: true decrypts the bookmark back', async () => {
      const bookmark = makeBookmark('b7')
      await db.put('bookmarks', bookmark)
      const session = await makeVault()
      await addPrivateTag(db, 'b7', 'private-tag-id')
      const result = await executePrivateAction(
        db, { kind: 'toggle-tag', bookmarkId: 'b7', currentlyTagged: true }, 'private-tag-id', session,
      )
      expect(result.failed).toEqual([])
      const stored = await db.get('bookmarks', 'b7')
      expect(stored.encryptedPayload).toBeUndefined()
      expect(stored.title).toBe('My Title')
    })

    it('toggle-tag removing reports a failure instead of throwing (session null)', async () => {
      const bookmark = makeBookmark('b9')
      await db.put('bookmarks', bookmark)
      await makeVault()
      await addPrivateTag(db, 'b9', 'private-tag-id')
      const result = await executePrivateAction(
        db, { kind: 'toggle-tag', bookmarkId: 'b9', currentlyTagged: true }, 'private-tag-id', null,
      )
      expect(result.failed).toEqual(['b9'])
      const stored = await db.get('bookmarks', 'b9')
      // Untouched — the failed remove never got to decrypt/write.
      expect(stored.encryptedPayload).toBeDefined()
    })

    it('batch-encrypt delegates to addPrivateTagBatch and surfaces failed ids', async () => {
      await db.put('bookmarks', makeBookmark('b8'))
      await makeVault()
      const result = await executePrivateAction(
        db, { kind: 'batch-encrypt', bookmarkIds: ['b8', 'missing-id'] }, 'private-tag-id', null,
      )
      expect(result.failed).toEqual([])
      const stored = await db.get('bookmarks', 'b8')
      expect(stored.encryptedPayload).toBeDefined()
    })
  })
})
