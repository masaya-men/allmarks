import { describe, it, expect, afterEach, vi } from 'vitest'
import { requestPersistentStorage, getStorageStatus } from '@/lib/storage/persist'

const nav = globalThis.navigator as Navigator & { storage?: unknown }
const original = Object.getOwnPropertyDescriptor(globalThis.navigator, 'storage')

function setStorage(storage: unknown): void {
  Object.defineProperty(globalThis.navigator, 'storage', { value: storage, configurable: true })
}

afterEach(() => {
  if (original) Object.defineProperty(globalThis.navigator, 'storage', original)
  else delete (nav as { storage?: unknown }).storage
  vi.restoreAllMocks()
})

describe('requestPersistentStorage', () => {
  it('returns false when StorageManager is absent', async () => {
    setStorage(undefined)
    expect(await requestPersistentStorage()).toBe(false)
  })

  it('returns true without re-prompting when already persisted', async () => {
    const persist = vi.fn(async () => true)
    setStorage({ persisted: vi.fn(async () => true), persist })
    expect(await requestPersistentStorage()).toBe(true)
    expect(persist).not.toHaveBeenCalled()
  })

  it('requests persist when not yet persisted and returns the grant result', async () => {
    setStorage({ persisted: vi.fn(async () => false), persist: vi.fn(async () => true) })
    expect(await requestPersistentStorage()).toBe(true)
  })

  it('returns false (no throw) when persist rejects', async () => {
    setStorage({ persisted: vi.fn(async () => false), persist: vi.fn(async () => { throw new Error('x') }) })
    expect(await requestPersistentStorage()).toBe(false)
  })
})

describe('getStorageStatus', () => {
  it('reports unsupported when StorageManager is absent', async () => {
    setStorage(undefined)
    expect(await getStorageStatus()).toEqual({ supported: false, persisted: false })
  })

  it('reports persisted + usage/quota from estimate', async () => {
    setStorage({
      persisted: vi.fn(async () => true),
      estimate: vi.fn(async () => ({ usage: 1234, quota: 99999 })),
    })
    expect(await getStorageStatus()).toEqual({
      supported: true, persisted: true, usageBytes: 1234, quotaBytes: 99999,
    })
  })

  it('tolerates a missing estimate()', async () => {
    setStorage({ persisted: vi.fn(async () => false) })
    expect(await getStorageStatus()).toEqual({ supported: true, persisted: false })
  })
})
