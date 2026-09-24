// lib/board/license-sign.test.ts
import { describe, it, expect } from 'vitest'
import { signPayload } from './license-sign'
import type { LicensePayload } from './license-types'

async function makeTestKeys() {
  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keyPair.privateKey))
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey))
  const toB64url = (b: Uint8Array) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return { publicKeyB64url: toB64url(raw), privateKeyB64url: toB64url(pkcs8) }
}

function toBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  return new Uint8Array(Buffer.from(b64 + '='.repeat((4 - (b64.length % 4)) % 4), 'base64'))
}

describe('signPayload', () => {
  it('produces a key string whose signature verifies against the matching public key', async () => {
    const { publicKeyB64url, privateKeyB64url } = await makeTestKeys()
    const payload: LicensePayload = { kid: 'kid-1', scope: ['sync'], v: 1, iat: 12345 }

    const key = await signPayload(payload, privateKeyB64url)
    const [payloadB64url, sigB64url] = key.split('.')

    const pub = await crypto.subtle.importKey('raw', new Uint8Array(toBytes(publicKeyB64url)), { name: 'Ed25519' }, true, ['verify'])
    const ok = await crypto.subtle.verify('Ed25519', pub, new Uint8Array(toBytes(sigB64url)), new TextEncoder().encode(payloadB64url))
    expect(ok).toBe(true)

    const decodedPayload = JSON.parse(new TextDecoder().decode(toBytes(payloadB64url)))
    expect(decodedPayload).toEqual(payload)
  })

  it('rejects (throws) when the private key material is malformed', async () => {
    const payload: LicensePayload = { kid: 'kid-1', scope: ['sync'], v: 1, iat: 1 }
    await expect(signPayload(payload, 'not-a-valid-key')).rejects.toThrow()
  })
})
