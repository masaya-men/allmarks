import { describe, it, expect } from 'vitest'
import {
  parseLicensePayload, bytesToBase64Url, base64UrlToBytes, payloadSigningBytes,
  encodeLicensePayload, encodeLicenseKey, decodeLicenseKey, type LicensePayload,
} from './license-types'

describe('parseLicensePayload', () => {
  it('accepts a well-formed v1 payload', () => {
    const r = parseLicensePayload({ kid: 'abc', scope: ['sync'], v: 1, iat: 1_780_000_000_000 })
    expect(r.ok).toBe(true)
  })
  it('rejects a wrong version', () => {
    const r = parseLicensePayload({ kid: 'abc', scope: ['sync'], v: 2, iat: 1 })
    expect(r.ok).toBe(false)
  })
  it('rejects an empty scope array', () => {
    const r = parseLicensePayload({ kid: 'abc', scope: [], v: 1, iat: 1 })
    expect(r.ok).toBe(false)
  })
  it('rejects a non-object', () => {
    expect(parseLicensePayload('not-an-object').ok).toBe(false)
  })
})

describe('base64url round-trip', () => {
  it('bytesToBase64Url / base64UrlToBytes round-trips arbitrary bytes, no padding chars', () => {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255, 16, 32, 64, 128])
    const encoded = bytesToBase64Url(bytes)
    expect(encoded).not.toMatch(/[+/=]/)
    expect(base64UrlToBytes(encoded)).toEqual(bytes)
  })
})

describe('encodeLicensePayload / decodeLicenseKey', () => {
  const payload: LicensePayload = { kid: 'kid-1', scope: ['sync'], v: 1, iat: 1_780_000_000_000 }

  it('decodeLicenseKey round-trips a well-formed key string', () => {
    const payloadB64url = encodeLicensePayload(payload)
    const fakeSignature = new Uint8Array(64).fill(7) // decodeLicenseKey doesn't verify — any 64 bytes
    const keyString = encodeLicenseKey(payloadB64url, fakeSignature)
    const decoded = decodeLicenseKey(keyString)
    expect(decoded).not.toBeNull()
    expect(decoded?.payload).toEqual(payload)
    expect(decoded?.payloadB64url).toBe(payloadB64url)
    expect(decoded?.signature).toEqual(fakeSignature)
  })

  it('payloadSigningBytes is the UTF-8 bytes of the payload segment (what gets signed)', () => {
    const payloadB64url = encodeLicensePayload(payload)
    const decoded = decodeLicenseKey(encodeLicenseKey(payloadB64url, new Uint8Array(64)))
    expect(payloadSigningBytes(decoded!.payloadB64url)).toEqual(new TextEncoder().encode(payloadB64url))
  })

  it('returns null for a key string with the wrong number of parts', () => {
    expect(decodeLicenseKey('only-one-part')).toBeNull()
    expect(decodeLicenseKey('a.b.c')).toBeNull()
  })

  it('returns null for malformed base64url in the payload segment', () => {
    expect(decodeLicenseKey('not-valid-base64!!!.' + bytesToBase64Url(new Uint8Array(64)))).toBeNull()
  })

  it('returns null when the decoded payload fails schema validation', () => {
    const badPayload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ kid: 'x' }))) // missing scope/v/iat
    expect(decodeLicenseKey(badPayload + '.' + bytesToBase64Url(new Uint8Array(64)))).toBeNull()
  })

  it('returns null when the signature segment is not exactly 64 bytes', () => {
    const payloadB64url = encodeLicensePayload(payload)
    expect(decodeLicenseKey(payloadB64url + '.' + bytesToBase64Url(new Uint8Array(63)))).toBeNull()
  })
})
