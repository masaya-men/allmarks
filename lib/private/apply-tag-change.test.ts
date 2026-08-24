import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { openDB, type IDBPDatabase } from 'idb'
import {
  addPrivateTag, removePrivateTag, addPrivateTagBatch, executePrivateAction,
  resolvePrivateStatus, PRIVATE_DROP_KEY,
} from './apply-tag-change'
import { deriveKey, generateSalt } from './crypto'
import type { PrivateVaultSession } from './vault-session'
import type { BookmarkRecord } from '@/lib/storage/indexeddb'

const TEST_DB = 'allmarks-test-apply-tag-change'

/* eslint-disable @typescript-eslint/no-explicit-any */
type TestDb = IDBPDatabase<any>

// db set up per the shared helper (tests/lib/storage/tags.test.ts pattern:
// fake-indexeddb/auto + idb.openDB, minimal in-memory schema, beforeEach
// wipes any leftover databases since fake-indexeddb persists per-process).
async function makeDb(): Promise<TestDb> {
  return await openDB(TEST_DB, 1, {
    upgrade(db) {
      const bs = db.createObjectStore('bookmarks', { keyPath: 'id' })
      bs.createIndex('by-tag', 'tags', { multiEntry: true })
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
    // 前テストの残骸を全消去 (= fake-indexeddb は process 内 persistent)
    const databases = await indexedDB.databases()
    for (const info of databases) {
      if (info.name) indexedDB.deleteDatabase(info.name)
    }
    db = await makeDb()
  })

  afterEach(() => {
    db.close()
  })

  async function makeSession(): Promise<PrivateVaultSession> {
    const key = await deriveKey('pw', generateSalt(), 1000)
    return { tagId: 'private-tag-id', key }
  }

  it('addPrivateTag encrypts the sensitive fields and blanks the plaintext columns', async () => {
    const bookmark = makeBookmark('b1')
    await db.put('bookmarks', bookmark)
    const session = await makeSession()
    await addPrivateTag(db, bookmark.id, 'private-tag-id', session)
    const updated = await db.get('bookmarks', bookmark.id)
    expect(updated.title).toBe('')
    expect(updated.url).toBe('')
    expect(updated.encryptedPayload).toBeDefined()
    expect(updated.tags).toContain('private-tag-id')
  })

  it('removePrivateTag decrypts the fields back to plaintext and clears encryptedPayload', async () => {
    const bookmark = makeBookmark('b2', { thumbnail: '' })
    await db.put('bookmarks', bookmark)
    const session = await makeSession()
    await addPrivateTag(db, bookmark.id, 'private-tag-id', session)
    await removePrivateTag(db, bookmark.id, 'private-tag-id', session)
    const restored = await db.get('bookmarks', bookmark.id)
    expect(restored.title).toBe('My Title')
    expect(restored.url).toBe('https://example.com')
    expect(restored.encryptedPayload).toBeUndefined()
    expect(restored.tags).not.toContain('private-tag-id')
  })

  it('addPrivateTag throws if the vault is locked (session null)', async () => {
    const bookmark = makeBookmark('b3')
    await db.put('bookmarks', bookmark)
    await expect(addPrivateTag(db, bookmark.id, 'private-tag-id', null)).rejects.toThrow('locked')
  })

  it('addPrivateTag also encrypts photos/mediaSlots and blanks them at rest', async () => {
    const bookmark = makeBookmark('b4', {
      photos: ['https://pbs.twimg.com/a.jpg'],
      mediaSlots: [{ type: 'photo', url: 'https://pbs.twimg.com/a.jpg' }],
    })
    await db.put('bookmarks', bookmark)
    const session = await makeSession()
    await addPrivateTag(db, bookmark.id, 'private-tag-id', session)
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
      const session = await makeSession()
      expect(resolvePrivateStatus('private-tag-id', session)).toBe('unlocked')
    })
  })

  describe('PRIVATE_DROP_KEY', () => {
    it('is a sentinel string, never a valid tag id shape', () => {
      expect(PRIVATE_DROP_KEY).toBe('__private__')
    })
  })

  describe('addPrivateTagBatch', () => {
    it('encrypts every listed bookmark not already Private', async () => {
      await db.put('bookmarks', makeBookmark('b1'))
      await db.put('bookmarks', makeBookmark('b2'))
      const session = await makeSession()
      const result = await addPrivateTagBatch(db, ['b1', 'b2'], 'private-tag-id', session)
      expect(result.succeeded).toEqual(['b1', 'b2'])
      expect(result.failed).toEqual([])
      const b1 = await db.get('bookmarks', 'b1')
      const b2 = await db.get('bookmarks', 'b2')
      expect(b1.encryptedPayload).toBeDefined()
      expect(b2.encryptedPayload).toBeDefined()
    })

    it('skips (as succeeded, unchanged) a bookmark already carrying the Private tag', async () => {
      const already = makeBookmark('b3', { tags: ['private-tag-id'], title: '', encryptedPayload: { iv: 'x', ciphertext: 'y' } })
      await db.put('bookmarks', already)
      const session = await makeSession()
      const result = await addPrivateTagBatch(db, ['b3'], 'private-tag-id', session)
      expect(result.succeeded).toEqual(['b3'])
      expect(result.failed).toEqual([])
      const stored = await db.get('bookmarks', 'b3')
      // Untouched — still the original encryptedPayload, not re-encrypted.
      expect(stored.encryptedPayload).toEqual({ iv: 'x', ciphertext: 'y' })
    })

    it('silently skips (neither list) a bookmark id that does not exist', async () => {
      const session = await makeSession()
      const result = await addPrivateTagBatch(db, ['does-not-exist'], 'private-tag-id', session)
      expect(result.succeeded).toEqual([])
      expect(result.failed).toEqual([])
    })

    it('reports a failing card without stopping the rest of the batch', async () => {
      await db.put('bookmarks', makeBookmark('b4'))
      await db.put('bookmarks', makeBookmark('b5'))
      // session === null makes every addPrivateTag call throw ("vault is locked"),
      // exercising the per-card try/catch without needing to fake IDB failures.
      const result = await addPrivateTagBatch(db, ['b4', 'b5'], 'private-tag-id', null)
      expect(result.succeeded).toEqual([])
      expect(result.failed).toEqual(['b4', 'b5'])
    })
  })

  describe('executePrivateAction', () => {
    it('toggle-tag with currentlyTagged: false encrypts the bookmark', async () => {
      await db.put('bookmarks', makeBookmark('b6'))
      const session = await makeSession()
      const result = await executePrivateAction(
        db, { kind: 'toggle-tag', bookmarkId: 'b6', currentlyTagged: false }, 'private-tag-id', session,
      )
      expect(result.failed).toEqual([])
      const stored = await db.get('bookmarks', 'b6')
      expect(stored.encryptedPayload).toBeDefined()
    })

    it('toggle-tag with currentlyTagged: true decrypts the bookmark back', async () => {
      const bookmark = makeBookmark('b7')
      await db.put('bookmarks', bookmark)
      const session = await makeSession()
      await addPrivateTag(db, 'b7', 'private-tag-id', session)
      const result = await executePrivateAction(
        db, { kind: 'toggle-tag', bookmarkId: 'b7', currentlyTagged: true }, 'private-tag-id', session,
      )
      expect(result.failed).toEqual([])
      const stored = await db.get('bookmarks', 'b7')
      expect(stored.encryptedPayload).toBeUndefined()
      expect(stored.title).toBe('My Title')
    })

    it('toggle-tag reports a failure instead of throwing (session null)', async () => {
      await db.put('bookmarks', makeBookmark('b9'))
      // session === null makes addPrivateTag throw ("vault is locked"); the
      // toggle-tag branch must catch it and report the id as failed, never
      // propagate — symmetric with addPrivateTagBatch's per-card contract
      // (final whole-branch review finding).
      const result = await executePrivateAction(
        db, { kind: 'toggle-tag', bookmarkId: 'b9', currentlyTagged: false }, 'private-tag-id', null,
      )
      expect(result.failed).toEqual(['b9'])
      const stored = await db.get('bookmarks', 'b9')
      expect(stored.encryptedPayload).toBeUndefined()
    })

    it('batch-encrypt delegates to addPrivateTagBatch and surfaces failed ids', async () => {
      await db.put('bookmarks', makeBookmark('b8'))
      const session = await makeSession()
      const result = await executePrivateAction(
        db, { kind: 'batch-encrypt', bookmarkIds: ['b8', 'missing-id'] }, 'private-tag-id', session,
      )
      expect(result.failed).toEqual([])
      const stored = await db.get('bookmarks', 'b8')
      expect(stored.encryptedPayload).toBeDefined()
    })
  })
})
