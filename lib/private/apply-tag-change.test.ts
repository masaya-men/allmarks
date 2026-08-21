import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { openDB, type IDBPDatabase } from 'idb'
import { addPrivateTag, removePrivateTag } from './apply-tag-change'
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
})
