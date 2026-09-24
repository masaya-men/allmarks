import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import type { IDBPDatabase } from 'idb'
import { initDB } from '@/lib/storage/indexeddb'
import { saveLicense, loadLicense, type LicenseState } from './license-store'
import { checkLicenseForSync, CHECK_INTERVAL_MS, GRACE_MS } from './license-check'

let db: IDBPDatabase<unknown> | null = null

beforeEach(async () => {
  const databases = await indexedDB.databases()
  for (const info of databases) { if (info.name) indexedDB.deleteDatabase(info.name) }
})
afterEach(() => { if (db) { db.close(); db = null } })

function fetchReturning(body: unknown, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })) as unknown as typeof fetch
}

const BASE: Pick<LicenseState, 'kid' | 'deviceId' | 'scope' | 'validatedAt'> = {
  kid: 'kid-1', deviceId: 'device-1', scope: ['sync'], validatedAt: 1_000,
}

describe('checkLicenseForSync', () => {
  it('no-license: nothing ever saved', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const fetchSpy = vi.fn()
    const result = await checkLicenseForSync(d, Date.now(), fetchSpy as unknown as typeof fetch)
    expect(result).toEqual({ allowed: false, reason: 'no-license' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('no-license: saved state does not include the sync scope', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await saveLicense(d, { ...BASE, scope: ['some-other-feature'] })
    const result = await checkLicenseForSync(d)
    expect(result).toEqual({ allowed: false, reason: 'no-license' })
  })

  it('stopped: returns the recorded reason without any network call', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const now = Date.now()
    await saveLicense(d, { ...BASE, lastCheckedAt: now, lastConfirmedAt: now, stopped: 'device-removed' })
    const fetchSpy = vi.fn()
    const result = await checkLicenseForSync(d, now, fetchSpy as unknown as typeof fetch)
    expect(result).toEqual({ allowed: false, reason: 'device-removed' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('within the check interval: allowed without a network call', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const now = Date.now()
    await saveLicense(d, { ...BASE, lastCheckedAt: now - 1_000, lastConfirmedAt: now - 1_000 })
    const fetchSpy = vi.fn()
    const result = await checkLicenseForSync(d, now, fetchSpy as unknown as typeof fetch)
    expect(result).toEqual({ allowed: true })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('interval elapsed and server confirms active: allowed, both timestamps refresh to now', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const now = Date.now()
    await saveLicense(d, { ...BASE, lastCheckedAt: now - CHECK_INTERVAL_MS - 1, lastConfirmedAt: now - CHECK_INTERVAL_MS - 1 })
    const fetchSpy = fetchReturning({ ok: true, active: true })

    const result = await checkLicenseForSync(d, now, fetchSpy)
    expect(result).toEqual({ allowed: true })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url] = vi.mocked(fetchSpy).mock.calls[0]
    expect(String(url)).toContain('kid=kid-1')
    expect(String(url)).toContain('device=device-1')
    const saved = await loadLicense(d)
    expect(saved?.lastCheckedAt).toBe(now)
    expect(saved?.lastConfirmedAt).toBe(now)
    expect(saved?.stopped).toBeUndefined()
  })

  // Still-active with reason:'unknown' (server never issued this kid — fail-open
  // per design §2.3) must be treated identically to plain active:true.
  it('interval elapsed and server confirms active with reason:unknown: still allowed', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const now = Date.now()
    await saveLicense(d, { ...BASE, lastCheckedAt: now - CHECK_INTERVAL_MS - 1, lastConfirmedAt: now - CHECK_INTERVAL_MS - 1 })
    const fetchSpy = fetchReturning({ ok: true, active: true, reason: 'unknown' })
    const result = await checkLicenseForSync(d, now, fetchSpy)
    expect(result).toEqual({ allowed: true })
  })

  it('ended: not allowed, `stopped` is persisted', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const now = Date.now()
    await saveLicense(d, { ...BASE, lastCheckedAt: now - CHECK_INTERVAL_MS - 1, lastConfirmedAt: now - CHECK_INTERVAL_MS - 1 })
    const fetchSpy = fetchReturning({ ok: true, active: false, reason: 'ended' })

    const result = await checkLicenseForSync(d, now, fetchSpy)
    expect(result).toEqual({ allowed: false, reason: 'ended' })
    const saved = await loadLicense(d)
    expect(saved?.stopped).toBe('ended')
    expect(saved?.lastCheckedAt).toBe(now)
  })

  it('device-removed: not allowed, `stopped` is persisted', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const now = Date.now()
    await saveLicense(d, { ...BASE, lastCheckedAt: now - CHECK_INTERVAL_MS - 1, lastConfirmedAt: now - CHECK_INTERVAL_MS - 1 })
    const fetchSpy = fetchReturning({ ok: true, active: false, reason: 'device-removed' })

    const result = await checkLicenseForSync(d, now, fetchSpy)
    expect(result).toEqual({ allowed: false, reason: 'device-removed' })
    const saved = await loadLicense(d)
    expect(saved?.stopped).toBe('device-removed')
  })

  it('network failure within grace: still allowed, does not set `stopped`', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const now = Date.now()
    const lastConfirmedAt = now - GRACE_MS + 1_000
    await saveLicense(d, { ...BASE, lastCheckedAt: now - CHECK_INTERVAL_MS - 1, lastConfirmedAt })
    const fetchSpy = vi.fn().mockRejectedValue(new Error('network down'))

    const result = await checkLicenseForSync(d, now, fetchSpy as unknown as typeof fetch)
    expect(result).toEqual({ allowed: true })
    const saved = await loadLicense(d)
    expect(saved?.stopped).toBeUndefined()
    expect(saved?.lastCheckedAt).toBe(now)
    expect(saved?.lastConfirmedAt).toBe(lastConfirmedAt) // unchanged — only lastCheckedAt moves
  })

  it('network failure beyond grace: grace-expired, but does NOT set `stopped` (auto-recovers on the next successful check)', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const now = Date.now()
    await saveLicense(d, { ...BASE, lastCheckedAt: now - CHECK_INTERVAL_MS - 1, lastConfirmedAt: now - GRACE_MS - 1_000 })
    const fetchSpy = vi.fn().mockRejectedValue(new Error('network down'))

    const result = await checkLicenseForSync(d, now, fetchSpy as unknown as typeof fetch)
    expect(result).toEqual({ allowed: false, reason: 'grace-expired' })
    const saved = await loadLicense(d)
    expect(saved?.stopped).toBeUndefined()
  })

  it('non-200 response and an unparsable/unexpected body are treated the same as a network failure', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const now = Date.now()
    await saveLicense(d, { ...BASE, lastCheckedAt: now - CHECK_INTERVAL_MS - 1, lastConfirmedAt: now - 1_000 })
    const fetchSpy = vi.fn().mockResolvedValue(new Response('not json', { status: 500 }))

    const result = await checkLicenseForSync(d, now, fetchSpy as unknown as typeof fetch)
    expect(result).toEqual({ allowed: true })
  })

  it('legacy record without lastCheckedAt/lastConfirmedAt: treated as never-checked, validatedAt stands in for lastConfirmedAt', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const now = Date.now()
    // Old-shape record: exactly what license-store.ts saved before this
    // feature existed — no lastCheckedAt/lastConfirmedAt/stopped at all.
    await saveLicense(d, { kid: 'kid-1', deviceId: 'device-1', scope: ['sync'], validatedAt: now - 1_000 })
    const fetchSpy = fetchReturning({ ok: true, active: true })

    const result = await checkLicenseForSync(d, now, fetchSpy)
    expect(result).toEqual({ allowed: true })
    expect(fetchSpy).toHaveBeenCalledTimes(1) // missing lastCheckedAt -> 0 -> interval always elapsed
  })

  it('legacy record whose validatedAt is already beyond the grace window and the server is unreachable: grace-expired', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const now = Date.now()
    await saveLicense(d, { kid: 'kid-1', deviceId: 'device-1', scope: ['sync'], validatedAt: now - GRACE_MS - 1_000 })
    const fetchSpy = vi.fn().mockRejectedValue(new Error('network down'))

    const result = await checkLicenseForSync(d, now, fetchSpy as unknown as typeof fetch)
    expect(result).toEqual({ allowed: false, reason: 'grace-expired' })
  })

  it('never throws when loading the license record fails (IDB hiccup) — treated as allowed', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const brokenDb = { get: () => Promise.reject(new Error('idb boom')) } as unknown as IDBPDatabase<unknown>
    const result = await checkLicenseForSync(brokenDb)
    expect(result).toEqual({ allowed: true })
  })
})
