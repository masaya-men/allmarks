import { describe, it, expect } from 'vitest'
import { generateSalt, deriveKey, encryptJson, decryptJson, PBKDF2_ITERATIONS } from './crypto'

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
