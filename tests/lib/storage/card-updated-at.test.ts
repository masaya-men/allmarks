import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { openDB, type IDBPDatabase } from 'idb'
import { addBookmark, updateCard } from '@/lib/storage/indexeddb'

/* eslint-disable @typescript-eslint/no-explicit-any */
type TestDb = IDBPDatabase<any>
const TEST_DB = 'allmarks-test-card-updatedat'

async function makeDb(): Promise<TestDb> {
  return openDB(TEST_DB, 1, {
    upgrade(db) {
      const bs = db.createObjectStore('bookmarks', { keyPath: 'id' })
      bs.createIndex('by-tag', 'tags', { multiEntry: true })
      const cs = db.createObjectStore('cards', { keyPath: 'id' })
      cs.createIndex('by-bookmark', 'bookmarkId')
    },
  })
}

describe('CardRecord.updatedAt', () => {
  let db: TestDb
  beforeEach(async () => {
    const dbs = await indexedDB.databases()
    for (const i of dbs) if (i.name) indexedDB.deleteDatabase(i.name)
    db = await makeDb()
  })
  afterEach(() => db.close())

  it('addBookmark seeds the card with updatedAt', async () => {
    const before = Date.now()
    const bm = await addBookmark(db as any, {
      url: 'https://x.com/a', title: 'a', description: '', thumbnail: '',
      favicon: '', siteName: '', type: 'website',
    })
    const cards = await db.getAllFromIndex('cards', 'by-bookmark', bm.id)
    expect(cards[0].updatedAt).toBeGreaterThanOrEqual(before)
  })

  it('updateCard bumps updatedAt', async () => {
    const bm = await addBookmark(db as any, {
      url: 'https://x.com/a', title: 'a', description: '', thumbnail: '',
      favicon: '', siteName: '', type: 'website',
    })
    const cards = await db.getAllFromIndex('cards', 'by-bookmark', bm.id)
    const cardId = cards[0].id
    await db.put('cards', { ...cards[0], updatedAt: 1000 })
    await updateCard(db as any, cardId, { x: 42 })
    const after = await db.get('cards', cardId)
    expect(after.x).toBe(42)
    expect(after.updatedAt).toBeGreaterThan(1000)
  })
})
