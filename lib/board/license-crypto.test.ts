import { describe, it, expect, vi, afterEach } from 'vitest'
import { verifyLicenseKey } from './license-crypto'
import { encodeLicensePayload, encodeLicenseKey, bytesToBase64Url, type LicensePayload } from './license-types'

async function generateTestKeyPair() {
  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
  const publicKeyB64url = bytesToBase64Url(new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey)))
  return { keyPair, publicKeyB64url }
}

async function signKey(payload: LicensePayload, privateKey: CryptoKey): Promise<string> {
  const payloadB64url = encodeLicensePayload(payload)
  const signature = new Uint8Array(
    await crypto.subtle.sign('Ed25519', privateKey, new TextEncoder().encode(payloadB64url)),
  )
  return encodeLicenseKey(payloadB64url, signature)
}

afterEach(() => { vi.restoreAllMocks() })

describe('verifyLicenseKey', () => {
  const payload: LicensePayload = { kid: 'kid-1', scope: ['sync'], v: 1, iat: 1_780_000_000_000 }

  it('valid: a correctly-signed key verifies against its own public key', async () => {
    const { keyPair, publicKeyB64url } = await generateTestKeyPair()
    const keyString = await signKey(payload, keyPair.privateKey)
    const result = await verifyLicenseKey(keyString, publicKeyB64url)
    expect(result).toEqual({ status: 'valid', payload })
  })

  it('invalid: a key signed by a DIFFERENT keypair fails verification', async () => {
    const signer = await generateTestKeyPair()
    const verifier = await generateTestKeyPair() // different keypair's public key
    const keyString = await signKey(payload, signer.keyPair.privateKey)
    const result = await verifyLicenseKey(keyString, verifier.publicKeyB64url)
    expect(result).toEqual({ status: 'invalid' })
  })

  it('invalid: a tampered payload (scope changed after signing) fails verification', async () => {
    const { keyPair, publicKeyB64url } = await generateTestKeyPair()
    const keyString = await signKey(payload, keyPair.privateKey)
    const [, sigPart] = keyString.split('.')
    const tamperedPayloadB64url = encodeLicensePayload({ ...payload, scope: ['sync', 'all-paid'] })
    const result = await verifyLicenseKey(`${tamperedPayloadB64url}.${sigPart}`, publicKeyB64url)
    expect(result).toEqual({ status: 'invalid' })
  })

  it('invalid: malformed key string (wrong format) never throws', async () => {
    const { publicKeyB64url } = await generateTestKeyPair()
    const result = await verifyLicenseKey('not-a-valid-key', publicKeyB64url)
    expect(result).toEqual({ status: 'invalid' })
  })

  it('unsupported: importKey rejecting (e.g. browser without Ed25519) is caught, never throws', async () => {
    const { keyPair, publicKeyB64url } = await generateTestKeyPair()
    const keyString = await signKey(payload, keyPair.privateKey)
    vi.spyOn(crypto.subtle, 'importKey').mockRejectedValueOnce(new Error('Ed25519 not supported'))
    const result = await verifyLicenseKey(keyString, publicKeyB64url)
    expect(result).toEqual({ status: 'unsupported' })
  })
})
