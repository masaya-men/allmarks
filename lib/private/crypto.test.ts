import { describe, it, expect } from 'vitest'
import { generateSalt, deriveKey, encryptJson, decryptJson, PBKDF2_ITERATIONS, generateEcdhKeyPair, exportPublicKeyB64, importPublicKey, wrapPrivateKey, unwrapPrivateKey, encryptWithPublicKey, decryptWithPrivateKey } from './crypto'

describe('private/crypto', () => {
  it('generateSalt returns a non-empty base64 string, different each call', () => {
    const a = generateSalt()
    const b = generateSalt()
    expect(a.length).toBeGreaterThan(0)
    expect(a).not.toBe(b)
  })

  it('encrypt then decrypt round-trips arbitrary JSON', async () => {
    const salt = generateSalt()
    const key = await deriveKey('correct horse battery staple', salt, PBKDF2_ITERATIONS)
    const original = { title: 'secret', n: 42, nested: { ok: true } }
    const { iv, ciphertext } = await encryptJson(key, original)
    const roundTripped = await decryptJson<typeof original>(key, iv, ciphertext)
    expect(roundTripped).toEqual(original)
  })

  it('two encryptions of the same data use different IVs', async () => {
    const salt = generateSalt()
    const key = await deriveKey('pw', salt, PBKDF2_ITERATIONS)
    const a = await encryptJson(key, { x: 1 })
    const b = await encryptJson(key, { x: 1 })
    expect(a.iv).not.toBe(b.iv)
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })

  it('decrypting with the wrong password throws', async () => {
    const salt = generateSalt()
    const rightKey = await deriveKey('right', salt, PBKDF2_ITERATIONS)
    const wrongKey = await deriveKey('wrong', salt, PBKDF2_ITERATIONS)
    const { iv, ciphertext } = await encryptJson(rightKey, { secret: true })
    await expect(decryptJson(wrongKey, iv, ciphertext)).rejects.toThrow()
  })

  it('deriveKey is deterministic for the same password+salt+iterations', async () => {
    const salt = generateSalt()
    const key1 = await deriveKey('same pw', salt, 1000)
    const key2 = await deriveKey('same pw', salt, 1000)
    const { iv, ciphertext } = await encryptJson(key1, { a: 1 })
    // If key2 isn't byte-identical to key1, this decrypt fails.
    await expect(decryptJson(key2, iv, ciphertext)).resolves.toEqual({ a: 1 })
  })
})

describe('private/crypto ECDH', () => {
  it('generateEcdhKeyPair produces a public+private key pair usable for ECDH', async () => {
    const pair = await generateEcdhKeyPair()
    expect(pair.publicKey.algorithm.name).toBe('ECDH')
    expect(pair.privateKey.algorithm.name).toBe('ECDH')
  })

  it('exportPublicKeyB64 then importPublicKey round-trips to a usable public key', async () => {
    const pair = await generateEcdhKeyPair()
    const b64 = await exportPublicKeyB64(pair.publicKey)
    const imported = await importPublicKey(b64)
    expect(imported.algorithm.name).toBe('ECDH')
    const envelope = await encryptWithPublicKey(imported, { ok: true })
    await expect(decryptWithPrivateKey(pair.privateKey, envelope)).resolves.toEqual({ ok: true })
  })

  it('wrapPrivateKey then unwrapPrivateKey round-trips to a usable private key', async () => {
    const pair = await generateEcdhKeyPair()
    const wrappingKey = await deriveKey('pw', generateSalt(), 1000)
    const wrapped = await wrapPrivateKey(pair.privateKey, wrappingKey)
    const unwrapped = await unwrapPrivateKey(wrapped, wrappingKey)
    const envelope = await encryptWithPublicKey(pair.publicKey, { secret: 42 })
    await expect(decryptWithPrivateKey(unwrapped, envelope)).resolves.toEqual({ secret: 42 })
  })

  it('the private key recovered by unwrapPrivateKey is non-extractable', async () => {
    const pair = await generateEcdhKeyPair()
    const wrappingKey = await deriveKey('pw', generateSalt(), 1000)
    const wrapped = await wrapPrivateKey(pair.privateKey, wrappingKey)
    const unwrapped = await unwrapPrivateKey(wrapped, wrappingKey)
    expect(unwrapped.extractable).toBe(false)
  })

  it('unwrapPrivateKey throws when given the wrong wrapping key (wrong password)', async () => {
    const pair = await generateEcdhKeyPair()
    const rightKey = await deriveKey('right', generateSalt(), 1000)
    const wrongKey = await deriveKey('wrong', generateSalt(), 1000)
    const wrapped = await wrapPrivateKey(pair.privateKey, rightKey)
    await expect(unwrapPrivateKey(wrapped, wrongKey)).rejects.toThrow()
  })

  it('encryptWithPublicKey then decryptWithPrivateKey round-trips arbitrary JSON', async () => {
    const pair = await generateEcdhKeyPair()
    const original = { title: 'secret', n: 42, nested: { ok: true } }
    const envelope = await encryptWithPublicKey(pair.publicKey, original)
    const roundTripped = await decryptWithPrivateKey<typeof original>(pair.privateKey, envelope)
    expect(roundTripped).toEqual(original)
  })

  it('two encryptions with the same public key use different ephemeral keys and ciphertexts', async () => {
    const pair = await generateEcdhKeyPair()
    const a = await encryptWithPublicKey(pair.publicKey, { x: 1 })
    const b = await encryptWithPublicKey(pair.publicKey, { x: 1 })
    expect(a.ephemeralPublicKey).not.toBe(b.ephemeralPublicKey)
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })

  it('decrypting with the wrong private key throws', async () => {
    const pairA = await generateEcdhKeyPair()
    const pairB = await generateEcdhKeyPair()
    const envelope = await encryptWithPublicKey(pairA.publicKey, { secret: true })
    await expect(decryptWithPrivateKey(pairB.privateKey, envelope)).rejects.toThrow()
  })
})
