import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { type IDBPDatabase } from 'idb'
import {
  initDB, getAllBookmarks, saveBookmarkDeduped, findActiveDuplicate,
  type BookmarkRecord,
} from '@/lib/storage/indexeddb'

let db: IDBPDatabase<unknown> | null = null

beforeEach(async () => {
  const fakeIndexedDB = globalThis.indexedDB
  const databases = await fakeIndexedDB.databases()
  for (const dbInfo of databases) {
    if (dbInfo.name) fakeIndexedDB.deleteDatabase(dbInfo.name)
  }
})

afterEach(() => {
  if (db) {
    (db as IDBPDatabase<unknown>).close()
    db = null
  }
})

const input = (url: string): Parameters<typeof saveBookmarkDeduped>[1] => ({
  url, title: 'T', description: '', thumbnail: '', favicon: '', siteName: '', type: 'website', tags: [],
})

describe('findActiveDuplicate', () => {
  const rec = (url: string, isDeleted?: boolean): BookmarkRecord =>
    ({ url, isDeleted } as BookmarkRecord)

  it('matches an active (non-deleted) bookmark with the exact same URL', () => {
    const all = [rec('https://a.com'), rec('https://b.com')]
    expect(findActiveDuplicate(all, 'https://b.com')?.url).toBe('https://b.com')
  })
  it('does NOT match a soft-deleted bookmark (re-save allowed)', () => {
    const all = [rec('https://a.com', true)]
    expect(findActiveDuplicate(all, 'https://a.com')).toBeNull()
  })
  it('returns null when no URL matches', () => {
    expect(findActiveDuplicate([rec('https://a.com')], 'https://z.com')).toBeNull()
  })
})

describe('saveBookmarkDeduped — scheme validation (rank2)', () => {
  it('rejects javascript: URLs and writes nothing', async () => {
    const database = await initDB()
    db = database as unknown as IDBPDatabase<unknown>
    // eslint-disable-next-line no-script-url
    const r = await saveBookmarkDeduped(database, input('javascript:alert(1)'), { dedupe: true })
    expect(r.outcome).toBe('invalid-url')
    expect(r.bookmark).toBeNull()
    expect(await getAllBookmarks(database)).toHaveLength(0)
  })

  it('rejects data: URLs', async () => {
    const database = await initDB()
    db = database as unknown as IDBPDatabase<unknown>
    const r = await saveBookmarkDeduped(database, input('data:text/html,<script>x</script>'), { dedupe: true })
    expect(r.outcome).toBe('invalid-url')
    expect(await getAllBookmarks(database)).toHaveLength(0)
  })

  it('accepts http/https and creates a bookmark + its card', async () => {
    const database = await initDB()
    db = database as unknown as IDBPDatabase<unknown>
    const r = await saveBookmarkDeduped(database, input('https://example.com'), { dedupe: true })
    expect(r.outcome).toBe('saved')
    const all = await getAllBookmarks(database)
    expect(all).toHaveLength(1)
    expect(all[0].orderIndex).toBe(0)
    const cards = (await database.getAll('cards')).filter((c) => c.bookmarkId === all[0].id)
    expect(cards).toHaveLength(1)
  })
})

describe('saveBookmarkDeduped — duplicate policy (rank14)', () => {
  it('dedupe:true short-circuits on an existing active duplicate (no 2nd row)', async () => {
    const database = await initDB()
    db = database as unknown as IDBPDatabase<unknown>
    await saveBookmarkDeduped(database, input('https://dup.com'), { dedupe: true })
    const r = await saveBookmarkDeduped(database, input('https://dup.com'), { dedupe: true })
    expect(r.outcome).toBe('duplicate')
    expect(await getAllBookmarks(database)).toHaveLength(1)
  })

  it('dedupe:false always inserts (the "save anyway" path)', async () => {
    const database = await initDB()
    db = database as unknown as IDBPDatabase<unknown>
    await saveBookmarkDeduped(database, input('https://copy.com'), { dedupe: false })
    const r = await saveBookmarkDeduped(database, input('https://copy.com'), { dedupe: false })
    expect(r.outcome).toBe('saved')
    expect(await getAllBookmarks(database)).toHaveLength(2)
  })

  it('a soft-deleted same-URL bookmark is not a duplicate (re-save allowed)', async () => {
    const database = await initDB()
    db = database as unknown as IDBPDatabase<unknown>
    const first = await saveBookmarkDeduped(database, input('https://redo.com'), { dedupe: true })
    expect(first.outcome).toBe('saved')
    // Soft-delete it.
    const tx = database.transaction('bookmarks', 'readwrite')
    await tx.objectStore('bookmarks').put({ ...first.bookmark!, isDeleted: true })
    await tx.done
    const second = await saveBookmarkDeduped(database, input('https://redo.com'), { dedupe: true })
    expect(second.outcome).toBe('saved')
    const active = (await getAllBookmarks(database)).filter((b) => !b.isDeleted)
    expect(active).toHaveLength(1)
  })
})

describe('saveBookmarkDeduped — concurrent same-URL save is atomic (rank30)', () => {
  it('two simultaneous dedupe saves of the same URL insert exactly ONE row', async () => {
    const database = await initDB()
    db = database as unknown as IDBPDatabase<unknown>
    const [r1, r2] = await Promise.all([
      saveBookmarkDeduped(database, input('https://race.example'), { dedupe: true }),
      saveBookmarkDeduped(database, input('https://race.example'), { dedupe: true }),
    ])
    const active = (await getAllBookmarks(database)).filter(
      (b) => b.url === 'https://race.example' && !b.isDeleted,
    )
    expect(active).toHaveLength(1)
    // One wins ('saved'), the other observes the first's write ('duplicate').
    expect([r1.outcome, r2.outcome].sort()).toEqual(['duplicate', 'saved'])
  })
})
