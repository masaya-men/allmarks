import { describe, it, expect, beforeEach } from 'vitest'
import { loadQuickTagEnabled, saveQuickTagEnabled } from './quick-tag-setting'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function makeFakeDb(): any {
  const store = new Map<string, unknown>()
  return {
    get: async (_name: string, key: string) => store.get(key),
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    put: async (_name: string, value: any) => { store.set(value.key, value); return value.key },
  }
}

describe('quick-tag-on-save setting', () => {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  let db: any
  beforeEach(() => { db = makeFakeDb() })

  it('defaults to ON when nothing saved', async () => {
    expect(await loadQuickTagEnabled(db)).toBe(true)
  })

  it('round-trips false', async () => {
    await saveQuickTagEnabled(db, false)
    expect(await loadQuickTagEnabled(db)).toBe(false)
  })

  it('round-trips true', async () => {
    await saveQuickTagEnabled(db, false)
    await saveQuickTagEnabled(db, true)
    expect(await loadQuickTagEnabled(db)).toBe(true)
  })

  it('falls back to default when stored value is not a boolean', async () => {
    await db.put('settings', { key: 'quick-tag-on-save', enabled: 'yes' })
    expect(await loadQuickTagEnabled(db)).toBe(true)
  })
})
