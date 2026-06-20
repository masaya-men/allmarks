// tests/lib/onboarding-demo.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import type { IDBPDatabase } from 'idb'
import { initDB, addBookmark, getAllBookmarks } from '@/lib/storage/indexeddb'
import {
  seedOnboardingDemo, clearOnboardingDemo, countOnboardingDemo,
} from '@/lib/onboarding/onboarding-demo'

let db: IDBPDatabase<unknown> | null = null
beforeEach(async () => {
  for (const info of await indexedDB.databases()) {
    if (info.name) indexedDB.deleteDatabase(info.name)
  }
})
afterEach(() => { if (db) { db.close(); db = null } })

describe('onboarding-demo', () => {
  it('seeds N flagged demo cards', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const ids = await seedOnboardingDemo(d, 6)
    expect(ids).toHaveLength(6)
    const all = await getAllBookmarks(d)
    expect(all.every((b) => b.onboardingDemo === true)).toBe(true)
    expect(await countOnboardingDemo(d)).toBe(6)
  })

  it('clear removes only demo cards, keeps real ones', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await addBookmark(d, {
      url: 'https://real.example', title: 'real', description: '', thumbnail: '',
      favicon: '', siteName: '', type: 'website',
    })
    await seedOnboardingDemo(d, 4)
    await clearOnboardingDemo(d)
    const all = await getAllBookmarks(d)
    expect(all).toHaveLength(1)
    expect(all[0]?.url).toBe('https://real.example')
  })

  it('re-seed clears prior demo first (no duplicates)', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await seedOnboardingDemo(d, 5)
    await seedOnboardingDemo(d, 5)
    expect(await countOnboardingDemo(d)).toBe(5)
  })
})
