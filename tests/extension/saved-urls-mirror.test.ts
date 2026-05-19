import { describe, it, expect, vi } from 'vitest'
import {
  STORAGE_KEY,
  MAX_ENTRIES,
  loadMirror,
  hasUrl,
  addUrl,
  removeUrl,
  maybePrune,
} from '../../extension/lib/saved-urls-mirror.js'

type AnyRecord = Record<string, unknown>
function makeFakeStorage(initial: AnyRecord = {}) {
  let store: AnyRecord = { ...initial }
  return {
    get: vi.fn(async (defaults: AnyRecord) => {
      const result: AnyRecord = {}
      for (const [k, v] of Object.entries(defaults)) {
        result[k] = Object.prototype.hasOwnProperty.call(store, k) ? store[k] : v
      }
      return result
    }),
    set: vi.fn(async (patch: AnyRecord) => {
      store = { ...store, ...patch }
    }),
    _peek: () => store,
  }
}

describe('loadMirror', () => {
  it('returns {} when storage is empty', async () => {
    const storage = makeFakeStorage()
    const mirror = await loadMirror(storage)
    expect(mirror).toEqual({})
  })

  it('returns the stored mirror', async () => {
    const storage = makeFakeStorage({ [STORAGE_KEY]: { 'https://a.com': 100 } })
    const mirror = await loadMirror(storage)
    expect(mirror).toEqual({ 'https://a.com': 100 })
  })
})

describe('hasUrl', () => {
  it('returns false for empty mirror', async () => {
    const storage = makeFakeStorage()
    expect(await hasUrl('https://a.com', storage)).toBe(false)
  })

  it('returns true for stored url', async () => {
    const storage = makeFakeStorage({ [STORAGE_KEY]: { 'https://a.com': 1 } })
    expect(await hasUrl('https://a.com', storage)).toBe(true)
  })

  it('returns false for non-stored url', async () => {
    const storage = makeFakeStorage({ [STORAGE_KEY]: { 'https://a.com': 1 } })
    expect(await hasUrl('https://b.com', storage)).toBe(false)
  })

  it('returns false for empty/null url', async () => {
    const storage = makeFakeStorage({ [STORAGE_KEY]: { 'https://a.com': 1 } })
    expect(await hasUrl('', storage)).toBe(false)
    expect(await hasUrl(null, storage)).toBe(false)
  })
})

describe('addUrl', () => {
  it('adds a new url with timestamp', async () => {
    const storage = makeFakeStorage()
    await addUrl('https://a.com', storage, 12345)
    expect(storage._peek()[STORAGE_KEY]).toEqual({ 'https://a.com': 12345 })
  })

  it('updates timestamp for existing url', async () => {
    const storage = makeFakeStorage({ [STORAGE_KEY]: { 'https://a.com': 100 } })
    await addUrl('https://a.com', storage, 999)
    const mirror = storage._peek()[STORAGE_KEY] as Record<string, number>
    expect(mirror['https://a.com']).toBe(999)
  })

  it('ignores empty/null url', async () => {
    const storage = makeFakeStorage()
    await addUrl('', storage, 1)
    await addUrl(null, storage, 1)
    expect(storage._peek()[STORAGE_KEY]).toBeUndefined()
  })
})

describe('removeUrl', () => {
  it('removes an existing url', async () => {
    const storage = makeFakeStorage({ [STORAGE_KEY]: { 'https://a.com': 1, 'https://b.com': 2 } })
    await removeUrl('https://a.com', storage)
    const mirror = storage._peek()[STORAGE_KEY] as Record<string, number>
    expect(mirror['https://a.com']).toBeUndefined()
    expect(mirror['https://b.com']).toBe(2)
  })

  it('is a no-op for missing url', async () => {
    const storage = makeFakeStorage({ [STORAGE_KEY]: { 'https://a.com': 1 } })
    await removeUrl('https://b.com', storage)
    const mirror = storage._peek()[STORAGE_KEY] as Record<string, number>
    expect(mirror['https://a.com']).toBe(1)
    // set should not have been called for a no-op
    expect(storage.set).not.toHaveBeenCalled()
  })

  it('ignores empty/null url', async () => {
    const storage = makeFakeStorage({ [STORAGE_KEY]: { 'https://a.com': 1 } })
    await removeUrl('', storage)
    await removeUrl(null, storage)
    const mirror = storage._peek()[STORAGE_KEY] as Record<string, number>
    expect(mirror['https://a.com']).toBe(1)
  })
})

describe('maybePrune', () => {
  it('returns input unchanged when under MAX_ENTRIES', () => {
    const m = { 'https://a.com': 1, 'https://b.com': 2 }
    expect(maybePrune(m)).toEqual(m)
  })

  it('drops oldest 10% when over MAX_ENTRIES', () => {
    const m: Record<string, number> = {}
    // Create MAX_ENTRIES + 1 entries with increasing timestamps.
    for (let i = 0; i <= MAX_ENTRIES; i++) m[`https://x${i}.com`] = i
    const pruned = maybePrune(m) as Record<string, number>
    const expectedDrop = Math.ceil((MAX_ENTRIES + 1) * 0.1)
    expect(Object.keys(pruned).length).toBe(MAX_ENTRIES + 1 - expectedDrop)
    // The very first (oldest) should be gone.
    expect(pruned['https://x0.com']).toBeUndefined()
    // The newest should survive.
    expect(pruned[`https://x${MAX_ENTRIES}.com`]).toBe(MAX_ENTRIES)
  })
})
