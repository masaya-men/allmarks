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

  it('does not mutate the caller\'s input object (pure)', () => {
    const overlongTitle = 'x'.repeat(600)
    const card = { u: 'https://a.com', t: overlongTitle, ty: 'website' as const, cw: 200, a: 1 }
    const input = { ...validShare, cards: [card], theme: 'wave' }
    const before = JSON.parse(JSON.stringify(input))

    const result = sanitizeShareDataV2(input)
    expect(result.ok).toBe(true)
    // Sanitized output is trimmed / theme-dropped …
    if (result.ok) {
      expect(result.data.cards[0].t.length).toBe(500)
      expect(result.data.theme).toBeUndefined()
    }
    // … but the original input is byte-for-byte unchanged.
    expect(input).toEqual(before)
    expect(input.cards[0].t.length).toBe(600)
    expect(input.cards[0]).toBe(card) // same card reference, untouched
    expect((input as Record<string, unknown>).theme).toBe('wave')
  })
})

describe('sanitizeShareDataV2 custom', () => {
  it('accepts a valid custom block and round-trips it', () => {
    const input = {
      v: 2, createdAt: 1, cards: [{ u: 'https://x.com/a', t: 'a', ty: 'tweet', cw: 200, a: 1 }],
      theme: 'dotted-notebook',
      custom: { edgeColor: '#0a0a0a', boardColor: '#0e0e11', patternColor: 'rgba(255,255,255,0.18)', patternType: 'grid', patternSize: 40, titleColor: '#fff', boardRounded: true },
    }
    const r = parseShareDataV2(input)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.custom?.patternType).toBe('grid')
      expect(r.data.custom?.boardRounded).toBe(true) // board-frame corners survive the round-trip
    }
  })

  it('sanitize drops a malformed custom instead of rejecting the whole payload', () => {
    const input = {
      v: 2, createdAt: 1, cards: [{ u: 'https://x.com/a', t: 'a', ty: 'tweet', cw: 200, a: 1 }],
      theme: 'dotted-notebook',
      custom: { patternType: 'not-a-pattern', patternSize: 99999 }, // invalid
    }
    const r = sanitizeShareDataV2(input)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.custom).toBeUndefined()
  })

  // A required patternStroke would have silently dropped `custom` from every
  // link created before the thickness slider.
  it('keeps custom on a link created before patternStroke existed', () => {
    const input = {
      v: 2, createdAt: 1, cards: [{ u: 'https://x.com/a', t: 'a', ty: 'tweet', cw: 200, a: 1 }],
      theme: 'dotted-notebook',
      custom: { edgeColor: '#0a0a0a', boardColor: '#0e0e11', patternColor: '#fff', patternType: 'grid', patternSize: 40, titleColor: '#fff' },
    }
    const r = sanitizeShareDataV2(input)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.custom).toBeDefined()
      expect(r.data.custom?.patternStroke).toBeUndefined()
    }
  })

  it('round-trips patternStroke, and drops the custom block when it is out of range', () => {
    const base = { edgeColor: '#0a0a0a', boardColor: '#0e0e11', patternColor: '#fff', patternType: 'grid', patternSize: 40, titleColor: '#fff' }
    const card = { u: 'https://x.com/a', t: 'a', ty: 'tweet', cw: 200, a: 1 }

    const ok = sanitizeShareDataV2({ v: 2, createdAt: 1, cards: [card], theme: 'dotted-notebook', custom: { ...base, patternStroke: 3.5 } })
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.data.custom?.patternStroke).toBe(3.5)

    const bad = sanitizeShareDataV2({ v: 2, createdAt: 1, cards: [card], theme: 'dotted-notebook', custom: { ...base, patternStroke: 999 } })
    expect(bad.ok).toBe(true)
    if (bad.ok) expect(bad.data.custom).toBeUndefined()
  })
})

describe('sanitizeShareDataV2 theme', () => {
  const base = { v: SHARE_SCHEMA_VERSION_V2, cards: [{ u: 'https://example.com', t: 'Title', ty: 'website' as const, cw: 200, a: 1.5 }], createdAt: 1735000000000 }
  it('keeps a valid ThemeId', () => {
    const r = sanitizeShareDataV2({ ...base, theme: 'dotted-notebook' })
    expect(r.ok && r.data.theme).toBe('dotted-notebook')
  })
  it('drops an unknown theme value (e.g. legacy "wave") to undefined', () => {
    const r = sanitizeShareDataV2({ ...base, theme: 'wave' })
    expect(r.ok && r.data.theme).toBeUndefined()
  })
  it('drops the retired "grid-paper" theme to undefined, so old grid shares fall back to the default world (their grid still rides in `custom`)', () => {
    const r = sanitizeShareDataV2({ ...base, theme: 'grid-paper' })
    expect(r.ok && r.data.theme).toBeUndefined()
  })
})
