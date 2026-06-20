// tests/lib/onboarding-state.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import type { IDBPDatabase } from 'idb'
import { initDB } from '@/lib/storage/indexeddb'
import {
  isOnboardingComplete, markOnboardingComplete, shouldAutoStartOnboarding,
} from '@/lib/onboarding/onboarding-state'

let db: IDBPDatabase<unknown> | null = null
beforeEach(async () => {
  for (const info of await indexedDB.databases()) {
    if (info.name) indexedDB.deleteDatabase(info.name)
  }
})
afterEach(() => { if (db) { db.close(); db = null } })

describe('onboarding-state', () => {
  it('defaults to not complete', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    expect(await isOnboardingComplete(d)).toBe(false)
  })
  it('marks complete and persists', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await markOnboardingComplete(d)
    expect(await isOnboardingComplete(d)).toBe(true)
  })
  it('auto-starts only when incomplete AND board empty', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    expect(await shouldAutoStartOnboarding(d, 0)).toBe(true)
    expect(await shouldAutoStartOnboarding(d, 3)).toBe(false)
    await markOnboardingComplete(d)
    expect(await shouldAutoStartOnboarding(d, 0)).toBe(false)
  })
})
