import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import type { IDBPDatabase } from 'idb'
import { initDB } from '@/lib/storage/indexeddb'
import { activateLicenseKey } from './license-activate'
import { loadLicense } from './license-store'
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
})
