import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { type IDBPDatabase } from 'idb'
import {
  initDB, addBookmark, getAllBookmarks, deleteBookmark, updateCard,
  updateBookmarkOrderIndex, updateBookmarkOrderBatch,
  nextOrderIndex, repairOrderIndexIfNeeded,
} from '@/lib/storage/indexeddb'

let db: IDBPDatabase<unknown> | null = null

beforeEach(async () => {
  // Reset fake-indexeddb global state
  const fakeIndexedDB = globalThis.indexedDB
  const databases = await fakeIndexedDB.databases()
  for (const dbInfo of databases) {
    if (dbInfo.name) {
      fakeIndexedDB.deleteDatabase(dbInfo.name)
    }
  }
})

afterEach(() => {
  // Close the database connection so deleteDatabase doesn't block
  if (db) {
    (db as IDBPDatabase<unknown>).close()
    db = null
  }
})

describe('bookmarks', () => {
  it('adds and retrieves bookmarks', async () => {
    const database = await initDB()
    db = database as unknown as IDBPDatabase<unknown>
    await addBookmark(database, {
      url: 'https://example.com', title: 'Example', description: 'A test site',
      thumbnail: '', favicon: '', siteName: 'Example', type: 'website', tags: [],
    })
    const bookmarks = await getAllBookmarks(database)
    expect(bookmarks).toHaveLength(1)
    expect(bookmarks[0].url).toBe('https://example.com')
    expect(bookmarks[0].tags).toEqual([])
  })

  it('deletes a bookmark and its card', async () => {
    const database = await initDB()
    db = database as unknown as IDBPDatabase<unknown>
    const bookmark = await addBookmark(database, {
      url: 'https://example.com', title: 'Example', description: '',
      thumbnail: '', favicon: '', siteName: '', type: 'website', tags: [],
    })
    await deleteBookmark(database, bookmark.id)
    expect(await getAllBookmarks(database)).toHaveLength(0)
    const cards = await database.getAll('cards')
    expect(cards.filter((c) => c.bookmarkId === bookmark.id)).toHaveLength(0)
  })
})

describe('cards', () => {
  it('creates card when bookmark is added', async () => {
    const database = await initDB()
    db = database as unknown as IDBPDatabase<unknown>
    const bookmark = await addBookmark(database, {
      url: 'https://example.com', title: 'Example', description: '',
      thumbnail: '', favicon: '', siteName: '', type: 'website', tags: [],
    })
    const cards = (await database.getAll('cards')).filter((c) => c.bookmarkId === bookmark.id)
    expect(cards).toHaveLength(1)
    expect(cards[0].x).toBeTypeOf('number')
    expect(cards[0].rotation).toBeTypeOf('number')
  })

  it('updates card position', async () => {
    const database = await initDB()
    db = database as unknown as IDBPDatabase<unknown>
    const bookmark = await addBookmark(database, {
      url: 'https://example.com', title: 'Example', description: '',
      thumbnail: '', favicon: '', siteName: '', type: 'website', tags: [],
    })
    const [card] = (await database.getAll('cards')).filter((c) => c.bookmarkId === bookmark.id)
    await updateCard(database, card.id, { x: 100, y: 200 })
    const updated = await database.get('cards', card.id)
    expect(updated?.x).toBe(100)
    expect(updated?.y).toBe(200)
  })
})

describe('v8 migration', () => {
  it('assigns orderIndex + sizePreset defaults to existing bookmarks', async () => {
    const database = await initDB()
    db = database as unknown as IDBPDatabase<unknown>
    await addBookmark(database, {
      url: 'https://a.com', title: 'A', description: '',
      thumbnail: '', favicon: '', siteName: '', type: 'website', tags: [],
    })
    await addBookmark(database, {
      url: 'https://b.com', title: 'B', description: '',
      thumbnail: '', favicon: '', siteName: '', type: 'website', tags: [],
    })
    const bookmarks = await getAllBookmarks(database)
    expect(bookmarks).toHaveLength(2)
    for (const b of bookmarks) {
      expect(typeof b.orderIndex).toBe('number')
      expect(b.sizePreset).toBe('S')
    }
    // orderIndex values should be unique
    const orders = bookmarks.map((b) => b.orderIndex).sort((x, y) => (x ?? 0) - (y ?? 0))
    expect(orders[0]).not.toBe(orders[1])
  })

  it('updateBookmarkOrderIndex changes the orderIndex', async () => {
    const database = await initDB()
    db = database as unknown as IDBPDatabase<unknown>
    const bm = await addBookmark(database, {
      url: 'https://a.com', title: 'A', description: '',
      thumbnail: '', favicon: '', siteName: '', type: 'website', tags: [],
    })
    await updateBookmarkOrderIndex(database, bm.id, 42)
    const [updated] = await getAllBookmarks(database)
    expect(updated.orderIndex).toBe(42)
  })

  it('updateBookmarkOrderBatch rewrites orderIndex atomically', async () => {
    const database = await initDB()
    db = database as unknown as IDBPDatabase<unknown>
    const bm1 = await addBookmark(database, {
      url: 'https://a.com', title: 'A', description: '',
      thumbnail: '', favicon: '', siteName: '', type: 'website', tags: [],
    })
    const bm2 = await addBookmark(database, {
      url: 'https://b.com', title: 'B', description: '',
      thumbnail: '', favicon: '', siteName: '', type: 'website', tags: [],
    })
    // Visual top-down order = [bm2, bm1]. Board sort is DESC by orderIndex,
    // so bm2 (the new top) must receive the HIGHEST orderIndex (= n-1 = 1)
    // and bm1 (now bottom) gets 0.
    await updateBookmarkOrderBatch(database, [bm2.id, bm1.id])
    const bookmarks = await getAllBookmarks(database)
    const byId = Object.fromEntries(bookmarks.map((b) => [b.id, b]))
    expect(byId[bm2.id].orderIndex).toBe(1)
    expect(byId[bm1.id].orderIndex).toBe(0)
  })
})

// Session 87: collision-safe orderIndex assignment + one-shot migration that
// fixes user data scrambled by the older `count`-based assignment.
describe('orderIndex collision-safe assignment (session 87)', () => {
  it('nextOrderIndex returns 0 on an empty store', async () => {
    const database = await initDB()
    db = database as unknown as IDBPDatabase<unknown>
    expect(await nextOrderIndex(database)).toBe(0)
  })

  it('nextOrderIndex returns max + 1, not count, so it survives EMPTY TRASH', async () => {
    const database = await initDB()
    db = database as unknown as IDBPDatabase<unknown>
    // Add 3, then physically remove the middle one (= EMPTY TRASH semantics).
    const a = await addBookmark(database, { url: 'https://a', title: 'A', description: '', thumbnail: '', favicon: '', siteName: '', type: 'website', tags: [] })
    const b = await addBookmark(database, { url: 'https://b', title: 'B', description: '', thumbnail: '', favicon: '', siteName: '', type: 'website', tags: [] })
    const c = await addBookmark(database, { url: 'https://c', title: 'C', description: '', thumbnail: '', favicon: '', siteName: '', type: 'website', tags: [] })
    // a=0, b=1, c=2. Now delete b → count=2 but max=2.
    await deleteBookmark(database, b.id)
    // BUG WAS: nextOrder = count = 2 → collides with c. FIX: max+1 = 3.
    expect(await nextOrderIndex(database)).toBe(3)
    // Adding here should issue 3, not 2.
    const d = await addBookmark(database, { url: 'https://d', title: 'D', description: '', thumbnail: '', favicon: '', siteName: '', type: 'website', tags: [] })
    expect(d.orderIndex).toBe(3)
    const all = await getAllBookmarks(database)
    const orderIndices = all.map((bm) => bm.orderIndex).sort()
    // No duplicate orderIndex despite the deletion + add sequence.
    expect(new Set(orderIndices).size).toBe(orderIndices.length)
    expect(orderIndices).toEqual([0, 2, 3])
    void a; void c
  })

  it('addBookmark on empty store assigns orderIndex 0', async () => {
    const database = await initDB()
    db = database as unknown as IDBPDatabase<unknown>
    const bm = await addBookmark(database, { url: 'https://a', title: 'A', description: '', thumbnail: '', favicon: '', siteName: '', type: 'website', tags: [] })
    expect(bm.orderIndex).toBe(0)
  })

  it('two concurrent addBookmark calls get UNIQUE orderIndex (rank22)', async () => {
    // The orderIndex high-water read now runs INSIDE the insert transaction, so
    // overlapping saves serialize (IDB orders same-scope readwrite txns) and the
    // second sees the first's write. Before the fix the read happened in a
    // separate txn beforehand and both saves could pick the same orderIndex.
    const database = await initDB()
    db = database as unknown as IDBPDatabase<unknown>
    const mk = (u: string) => addBookmark(database, { url: u, title: u, description: '', thumbnail: '', favicon: '', siteName: '', type: 'website' as const, tags: [] })
    const [a, b] = await Promise.all([mk('https://a'), mk('https://b')])
    expect(a.orderIndex).not.toBe(b.orderIndex)
    const all = await getAllBookmarks(database)
    const indices = all.map((bm) => bm.orderIndex)
    expect(new Set(indices).size).toBe(indices.length) // no duplicates
    expect([...indices].sort((x, y) => (x ?? 0) - (y ?? 0))).toEqual([0, 1])
  })
})

describe('repairOrderIndexIfNeeded (session 87 migration)', () => {
  it('no-op on an empty store, marks flag so subsequent runs short-circuit', async () => {
    const database = await initDB()
    db = database as unknown as IDBPDatabase<unknown>
    const r1 = await repairOrderIndexIfNeeded(database)
    expect(r1.ran).toBe(true)
    expect(r1.updated).toBe(0)
    const r2 = await repairOrderIndexIfNeeded(database)
    expect(r2.ran).toBe(false)  // flag set, skips
  })

  it('resorts by savedAt DESC: newest gets highest orderIndex (visible top under DESC sort)', async () => {
    const database = await initDB()
    db = database as unknown as IDBPDatabase<unknown>
    // Three bookmarks with EXPLICIT savedAt + scrambled pre-migration
    // orderIndex (= mimics post-EMPTY-TRASH state where new save collided
    // with an old surviving record). The migration's job is to ignore the
    // junk orderIndex and re-sort strictly by savedAt DESC.
    const aRec = { id: 'a-oldest',  url: 'https://a', title: 'A', description: '', thumbnail: '', favicon: '', siteName: '', type: 'website' as const, tags: [], savedAt: '2026-05-26T00:00:00.000Z', ogpStatus: 'fetched' as const, orderIndex: 99 }
    const bRec = { id: 'b-middle',  url: 'https://b', title: 'B', description: '', thumbnail: '', favicon: '', siteName: '', type: 'website' as const, tags: [], savedAt: '2026-05-27T00:00:00.000Z', ogpStatus: 'fetched' as const, orderIndex: 5 }
    // c is the NEWEST but its colliding low orderIndex would have buried it
    // mid-board under the old ASC sort — exactly the user-reported scenario.
    const cRec = { id: 'c-newest',  url: 'https://c', title: 'C', description: '', thumbnail: '', favicon: '', siteName: '', type: 'website' as const, tags: [], savedAt: '2026-05-28T00:00:00.000Z', ogpStatus: 'fetched' as const, orderIndex: 5 }
    const tx = database.transaction('bookmarks', 'readwrite')
    await tx.objectStore('bookmarks').put(aRec)
    await tx.objectStore('bookmarks').put(bRec)
    await tx.objectStore('bookmarks').put(cRec)
    await tx.done

    const result = await repairOrderIndexIfNeeded(database)
    expect(result.ran).toBe(true)
    expect(result.updated).toBeGreaterThan(0)

    const after = await getAllBookmarks(database)
    const byId = Object.fromEntries(after.map((bm) => [bm.id, bm]))
    // Indices are unique and exactly 0..N-1.
    const indices = after.map((bm) => bm.orderIndex).sort((x, y) => (x ?? 0) - (y ?? 0))
    expect(new Set(indices).size).toBe(indices.length)
    expect(indices).toEqual([0, 1, 2])
    // Newest savedAt (= c) gets HIGHEST orderIndex (= visible first under
    // DESC). Oldest (= a) gets LOWEST (= visible last).
    expect(byId['c-newest'].orderIndex).toBe(2)
    expect(byId['b-middle'].orderIndex).toBe(1)
    expect(byId['a-oldest'].orderIndex).toBe(0)
  })

  it('writes the guard flag back to settings after a run (rank41 write-back)', async () => {
    const database = await initDB()
    db = database as unknown as IDBPDatabase<unknown>
    await addBookmark(database, { url: 'https://a', title: 'A', description: '', thumbnail: '', favicon: '', siteName: '', type: 'website', tags: [] })
    const r = await repairOrderIndexIfNeeded(database)
    expect(r.ran).toBe(true)
    // The flag must actually be persisted, otherwise the next launch re-runs
    // and clobbers the user's manual reorder.
    const mig = await database.get('settings', 'migration')
    expect(mig?.migrationFlags?.orderIndexRepairV2).toBe(true)
  })

  it('fails safe (does NOT re-run) when the guard read throws (rank22/rank41)', async () => {
    // A transient failure reading the migration flag must not be read as "not
    // migrated" — re-running re-sorts by savedAt and would clobber the user's
    // manual drag-reorder. So a throwing `get` returns {ran:false} and never
    // touches the bookmarks store.
    const getAll = vi.fn()
    const fakeDb = {
      get: vi.fn().mockRejectedValue(new Error('transient read failure')),
      getAll,
    } as unknown as Parameters<typeof repairOrderIndexIfNeeded>[0]
    const res = await repairOrderIndexIfNeeded(fakeDb)
    expect(res).toEqual({ ran: false, updated: 0 })
    expect(getAll).not.toHaveBeenCalled() // bailed before reading bookmarks
  })

  it('is idempotent (second run does not flip the order back)', async () => {
    const database = await initDB()
    db = database as unknown as IDBPDatabase<unknown>
    await addBookmark(database, { url: 'https://a', title: 'A', description: '', thumbnail: '', favicon: '', siteName: '', type: 'website', tags: [] })
    await addBookmark(database, { url: 'https://b', title: 'B', description: '', thumbnail: '', favicon: '', siteName: '', type: 'website', tags: [] })
    await repairOrderIndexIfNeeded(database)
    const first = await getAllBookmarks(database)
    const firstSnapshot = Object.fromEntries(first.map((bm) => [bm.id, bm.orderIndex]))
    const r2 = await repairOrderIndexIfNeeded(database)
    expect(r2.ran).toBe(false)
    const after = await getAllBookmarks(database)
    for (const bm of after) {
      expect(bm.orderIndex).toBe(firstSnapshot[bm.id])
    }
  })
})
