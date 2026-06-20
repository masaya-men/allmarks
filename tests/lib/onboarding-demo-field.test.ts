import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import type { IDBPDatabase } from 'idb'
import { initDB, addBookmark, getAllBookmarks } from '@/lib/storage/indexeddb'
import { BOARD_Z_INDEX } from '@/lib/board/constants'

let db: IDBPDatabase<unknown> | null = null
beforeEach(async () => {
  for (const info of await indexedDB.databases()) {
    if (info.name) indexedDB.deleteDatabase(info.name)
  }
})
afterEach(() => { if (db) { db.close(); db = null } })

describe('onboardingDemo field', () => {
  it('persists onboardingDemo=true through addBookmark', async () => {
    const d = await initDB()
    db = d as unknown as IDBPDatabase<unknown>
    await addBookmark(d, {
      url: 'https://example.com/a', title: 'A', description: '', thumbnail: '',
      favicon: '', siteName: '', type: 'website', onboardingDemo: true,
    })
    const all = await getAllBookmarks(d)
    expect(all[0]?.onboardingDemo).toBe(true)
  })

  it('omits onboardingDemo for normal saves', async () => {
    const d = await initDB()
    db = d as unknown as IDBPDatabase<unknown>
    await addBookmark(d, {
      url: 'https://example.com/b', title: 'B', description: '', thumbnail: '',
      favicon: '', siteName: '', type: 'website',
    })
    const all = await getAllBookmarks(d)
    expect(all[0]?.onboardingDemo).toBeUndefined()
  })

  it('ONBOARDING z-index sits above MODAL_OVERLAY', () => {
    expect(BOARD_Z_INDEX.ONBOARDING).toBeGreaterThan(BOARD_Z_INDEX.MODAL_OVERLAY)
  })
})
