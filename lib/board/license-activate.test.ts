import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import type { IDBPDatabase } from 'idb'
import { initDB } from '@/lib/storage/indexeddb'
import {
  activateLicenseKey, buildDeviceLabel, fetchDeviceCount, registerDeviceLabel, releaseDevice,
} from './license-activate'
import { loadLicense, saveLicense } from './license-store'
import { encodeLicensePayload, encodeLicenseKey, bytesToBase64Url, type LicensePayload } from './license-types'

let db: IDBPDatabase<unknown> | null = null

beforeEach(async () => {
  const databases = await indexedDB.databases()
  for (const info of databases) { if (info.name) indexedDB.deleteDatabase(info.name) }
})
afterEach(() => { if (db) { db.close(); db = null }; vi.restoreAllMocks(); vi.unstubAllGlobals() })

async function makeSignedKey(payload: LicensePayload) {
  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
  const publicKeyB64url = bytesToBase64Url(new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey)))
  const payloadB64url = encodeLicensePayload(payload)
  const signature = new Uint8Array(await crypto.subtle.sign('Ed25519', keyPair.privateKey, new TextEncoder().encode(payloadB64url)))
  return { keyString: encodeLicenseKey(payloadB64url, signature), publicKeyB64url }
}

const payload: LicensePayload = { kid: 'kid-1', scope: ['sync'], v: 1, iat: 1_780_000_000_000 }

describe('activateLicenseKey', () => {
  it('invalid-key: a bad signature is rejected before any network call', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const result = await activateLicenseKey(d, 'not-a-real-key')
    expect(result).toEqual({ status: 'invalid-key' })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(await loadLicense(d)).toBeNull()
  })

  it('unlocked (verified:true): server confirms activation, license is persisted', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const { keyString, publicKeyB64url } = await makeSignedKey(payload)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })))

    const result = await activateLicenseKey(d, keyString, publicKeyB64url)
    expect(result).toEqual({ status: 'unlocked', scope: ['sync'], verified: true })
    const saved = await loadLicense(d)
    expect(saved?.kid).toBe('kid-1')
    expect(saved?.scope).toEqual(['sync'])
  })

  it('cap-exceeded: hard deny, nothing persisted', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const { keyString, publicKeyB64url } = await makeSignedKey(payload)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, reason: 'cap-exceeded' }), { status: 200 }),
    ))

    const result = await activateLicenseKey(d, keyString, publicKeyB64url)
    expect(result).toEqual({ status: 'cap-exceeded' })
    expect(await loadLicense(d)).toBeNull()
  })

  it('fail-open (verified:false): network error still unlocks locally (valid signature trusted)', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const { keyString, publicKeyB64url } = await makeSignedKey(payload)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const result = await activateLicenseKey(d, keyString, publicKeyB64url)
    expect(result).toEqual({ status: 'unlocked', scope: ['sync'], verified: false })
    const saved = await loadLicense(d)
    expect(saved?.kid).toBe('kid-1')
  })

  it('fail-open (verified:false): an unknown-key server response also unlocks locally', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const { keyString, publicKeyB64url } = await makeSignedKey(payload)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, reason: 'unknown-key' }), { status: 200 }),
    ))

    const result = await activateLicenseKey(d, keyString, publicKeyB64url)
    expect(result).toEqual({ status: 'unlocked', scope: ['sync'], verified: false })
    expect(await loadLicense(d)).not.toBeNull()
  })

  it('same deviceId is stable across calls (reuses getDeviceId, not a fresh uuid each time)', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const { keyString, publicKeyB64url } = await makeSignedKey(payload)
    let capturedBody: { deviceId?: string } = {}
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init!.body as string)
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }))

    await activateLicenseKey(d, keyString, publicKeyB64url)
    const firstDeviceId = capturedBody.deviceId
    await activateLicenseKey(d, keyString, publicKeyB64url)
    expect(capturedBody.deviceId).toBe(firstDeviceId)
  })

  it('sends a device label derived from the current User-Agent in the /activate body', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const { keyString, publicKeyB64url } = await makeSignedKey(payload)
    let capturedBody: { label?: string } = {}
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init!.body as string)
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }))

    await activateLicenseKey(d, keyString, publicKeyB64url)
    expect(capturedBody.label).toBe(buildDeviceLabel(navigator.userAgent))
  })

  // design §3.2 / §2.5: re-entering a key is how a device recovers from
  // `stopped` (ended/device-removed) — saveLicense's put() writes a whole
  // new record, so nothing from the old one (including `stopped`) survives.
  it('re-activating a key clears a previous `stopped` flag and resets the check timestamps', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const { keyString, publicKeyB64url } = await makeSignedKey(payload)
    await saveLicense(d, {
      kid: 'kid-1', deviceId: 'old-device', scope: ['sync'], validatedAt: 1,
      lastCheckedAt: 1, lastConfirmedAt: 1, stopped: 'device-removed',
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })))

    const before = Date.now()
    const result = await activateLicenseKey(d, keyString, publicKeyB64url)
    expect(result.status).toBe('unlocked')
    const saved = await loadLicense(d)
    expect(saved?.stopped).toBeUndefined()
    expect(saved?.lastCheckedAt).toBeGreaterThanOrEqual(before)
    expect(saved?.lastConfirmedAt).toBeGreaterThanOrEqual(before)
  })
})

describe('buildDeviceLabel', () => {
  it('detects Chrome on Windows', () => {
    expect(buildDeviceLabel(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    )).toBe('Chrome · Windows')
  })

  it('detects Firefox on macOS', () => {
    expect(buildDeviceLabel(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0',
    )).toBe('Firefox · macOS')
  })

  it('detects Safari on iOS, not confused with Chrome', () => {
    expect(buildDeviceLabel(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    )).toBe('Safari · iOS')
  })

  it('detects Edge on Windows, not confused with Chrome (Edge UA also contains Chrome/)', () => {
    expect(buildDeviceLabel(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    )).toBe('Edge · Windows')
  })

  it('detects Chrome on Android', () => {
    expect(buildDeviceLabel(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    )).toBe('Chrome · Android')
  })

  it('falls back to generic names for an unrecognized User-Agent', () => {
    expect(buildDeviceLabel('SomeWeirdBot/1.0')).toBe('Browser · Unknown')
  })

  it('never exceeds 60 characters', () => {
    const veryLongUa = `Mozilla/5.0 Chrome/${'1'.repeat(100)} Windows`
    expect(buildDeviceLabel(veryLongUa).length).toBeLessThanOrEqual(60)
  })
})

describe('fetchDeviceCount', () => {
  it('returns count/max/devices on a well-formed response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true, count: 2, max: 5,
      devices: [{ id: 'd1', label: 'Chrome · Windows', at: 100 }, { id: 'd2', label: '', at: 200 }],
    }), { status: 200 })))

    const result = await fetchDeviceCount('kid-1')
    expect(result).toEqual({
      count: 2, max: 5,
      devices: [{ id: 'd1', label: 'Chrome · Windows', at: 100 }, { id: 'd2', label: '', at: 200 }],
    })
  })

  it('drops malformed device entries but keeps the well-formed ones', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true, count: 3, max: 5,
      devices: [{ id: 'd1', label: 'Chrome · Windows', at: 100 }, { id: '', label: 'bad-id' }, 'not-an-object', { id: 'd2' }],
    }), { status: 200 })))

    const result = await fetchDeviceCount('kid-1')
    expect(result?.devices).toEqual([{ id: 'd1', label: 'Chrome · Windows', at: 100 }])
  })

  it('falls back to an empty devices array when the field is missing entirely', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, count: 0, max: 5 }), { status: 200 })))
    const result = await fetchDeviceCount('kid-1')
    expect(result).toEqual({ count: 0, max: 5, devices: [] })
  })

  it('returns null on a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    expect(await fetchDeviceCount('kid-1')).toBeNull()
  })
})

describe('registerDeviceLabel', () => {
  it('POSTs /activate with this device\'s id and a fresh User-Agent-derived label', async () => {
    let capturedUrl: string | null = null
    let capturedBody: { kid?: string; deviceId?: string; label?: string } = {}
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      capturedUrl = url
      capturedBody = JSON.parse(init!.body as string)
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }))

    await registerDeviceLabel('kid-1', 'my-device')
    expect(capturedUrl).toBe('/activate')
    expect(capturedBody).toEqual({ kid: 'kid-1', deviceId: 'my-device', label: buildDeviceLabel(navigator.userAgent) })
  })

  it('never throws on a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    await expect(registerDeviceLabel('kid-1', 'my-device')).resolves.toBeUndefined()
  })

  it('never throws on a cap-exceeded response (no special handling — the device already holds a license)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, reason: 'cap-exceeded' }), { status: 200 })))
    await expect(registerDeviceLabel('kid-1', 'my-device')).resolves.toBeUndefined()
  })

  it('never throws on a malformed response body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json', { status: 200 })))
    await expect(registerDeviceLabel('kid-1', 'my-device')).resolves.toBeUndefined()
  })
})

describe('releaseDevice', () => {
  it('returns true when the server confirms {ok:true}, sending kid/deviceId/target', async () => {
    let capturedBody: unknown = null
    let capturedUrl: string | null = null
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      capturedUrl = url
      capturedBody = JSON.parse(init!.body as string)
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }))

    const result = await releaseDevice('kid-1', 'my-device', 'target-device')
    expect(result).toBe(true)
    expect(capturedUrl).toBe('/api/license/release')
    expect(capturedBody).toEqual({ kid: 'kid-1', deviceId: 'my-device', target: 'target-device' })
  })

  it('returns false on an explicit {ok:false} (e.g. not-authorized)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, reason: 'not-authorized' }), { status: 200 })))
    expect(await releaseDevice('kid-1', 'my-device', 'target-device')).toBe(false)
  })

  it('returns false and never throws on a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    await expect(releaseDevice('kid-1', 'my-device', 'target-device')).resolves.toBe(false)
  })

  it('returns false on a non-ok HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 500 })))
    expect(await releaseDevice('kid-1', 'my-device', 'target-device')).toBe(false)
  })
})
