// lib/share/validate-v2.test.ts
import { describe, it, expect } from 'vitest'
import { parseShareDataV2, sanitizeShareDataV2 } from './validate-v2'
import { SHARE_SCHEMA_VERSION_V2, type ShareDataV2 } from './types-v2'

const validShare: ShareDataV2 = {
  v: SHARE_SCHEMA_VERSION_V2,
  cards: [
    { u: 'https://example.com', t: 'Title', ty: 'website', cw: 200, a: 1.5 },
  ],
  createdAt: 1735000000000,
}

describe('parseShareDataV2', () => {
  it('accepts a minimal valid payload', () => {
    const result = parseShareDataV2(validShare)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.cards.length).toBe(1)
  })

  it('rejects unknown schema version', () => {
    const result = parseShareDataV2({ ...validShare, v: 99 })
    expect(result.ok).toBe(false)
  })

  it('rejects more than MAX_CARDS', () => {
    const cards = Array.from({ length: 101 }, (_, i) => ({
      u: `https://example.com/${i}`, t: `T${i}`, ty: 'website' as const, cw: 200, a: 1,
    }))
    const result = parseShareDataV2({ ...validShare, cards })
    expect(result.ok).toBe(false)
  })

  it('rejects non-http URL', () => {
    const result = parseShareDataV2({
      ...validShare,
      cards: [{ u: 'javascript:alert(1)', t: 'X', ty: 'website', cw: 200, a: 1 }],
    })
    expect(result.ok).toBe(false)
  })

  it('rejects title over MAX_TITLE', () => {
    const result = parseShareDataV2({
      ...validShare,
      cards: [{ u: 'https://a.com', t: 'x'.repeat(501), ty: 'website', cw: 200, a: 1 }],
    })
    expect(result.ok).toBe(false)
  })

  it('accepts cards with sender tags', () => {
    const result = parseShareDataV2({
      ...validShare,
      cards: [{ u: 'https://a.com', t: 'T', ty: 'website', cw: 200, a: 1, tg: ['t1', 't2'] }],
      tags: { t1: { n: 'music' }, t2: { n: 'design', c: '#28F100' } },
    })
    expect(result.ok).toBe(true)
  })
})

describe('sanitizeShareDataV2', () => {
  it('strips fields not in schema', () => {
    const dirty = { ...validShare, evil: 'payload' } as unknown
    const clean = sanitizeShareDataV2(dirty)
    expect(clean.ok).toBe(true)
    if (clean.ok) expect((clean.data as Record<string, unknown>).evil).toBeUndefined()
  })

  it('trims title to MAX_TITLE', () => {
    const result = sanitizeShareDataV2({
      ...validShare,
      cards: [{ u: 'https://a.com', t: 'x'.repeat(600), ty: 'website', cw: 200, a: 1 }],
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.cards[0].t.length).toBe(500)
  })
})
