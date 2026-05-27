// lib/share/kv-id.test.ts
import { describe, it, expect } from 'vitest'
import { generateShareId, isValidShareId } from './kv-id'

describe('generateShareId', () => {
  it('returns a 6-char base62 string', () => {
    const id = generateShareId()
    expect(id).toMatch(/^[A-Za-z0-9]{6}$/)
  })

  it('returns unique IDs across 1000 invocations', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      const id = generateShareId()
      expect(seen.has(id)).toBe(false)
      seen.add(id)
    }
    expect(seen.size).toBe(1000)
  })
})

describe('isValidShareId', () => {
  it('accepts valid 6-char base62', () => {
    expect(isValidShareId('k3p9xv')).toBe(true)
    expect(isValidShareId('AaZz09')).toBe(true)
  })

  it('rejects wrong length', () => {
    expect(isValidShareId('k3p9x')).toBe(false)
    expect(isValidShareId('k3p9xvy')).toBe(false)
  })

  it('rejects non-base62 chars', () => {
    expect(isValidShareId('k3p_xv')).toBe(false)
    expect(isValidShareId('k3p-xv')).toBe(false)
    expect(isValidShareId('k3p xv')).toBe(false)
  })
})
