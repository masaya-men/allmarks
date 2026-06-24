import { describe, it, expect } from 'vitest'
import { getCardDecorations } from './paper-decorations'

describe('getCardDecorations', () => {
  it('is deterministic — same id yields a deep-equal set', () => {
    const a = getCardDecorations('bookmark-abc')
    const b = getCardDecorations('bookmark-abc')
    expect(a).toEqual(b)
    // returns a fresh object each call (no shared mutable reference)
    expect(a).not.toBe(b)
  })

  it('PRNG regression guard — concrete output is pinned to today\'s mulberry32+FNV-1a impl', () => {
    // Values derived by running the algorithm in Node (node --input-type=module) on 2026-06-24.
    // If the PRNG, hash function, or generation logic changes, these assertions WILL fail —
    // that is the intent. Update only after a deliberate visual-regression review.
    expect(getCardDecorations('bookmark-abc')).toEqual({
      photoCorners: ['tl', 'br'],
      washi: [
        { tint: 'b', edge: 'bottom', angleDeg: 5.6, offsetPct: 69.4 },
        { tint: 'b', edge: 'right', angleDeg: 0.6, offsetPct: 22.3 },
      ],
      pin: true,
      clip: false,
      stamp: { label: 'RATED', corner: 'br', angleDeg: -16.7 },
    })
    expect(getCardDecorations('card-xyz-7')).toEqual({
      photoCorners: ['tr'],
      washi: [
        { tint: 'a', edge: 'bottom', angleDeg: 5, offsetPct: 15.1 },
      ],
      pin: false,
      clip: false,
      stamp: null,
    })
  })

  it('generally differs across ids', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
    const serialized = ids.map((id) => JSON.stringify(getCardDecorations(id)))
    const unique = new Set(serialized)
    // not all 10 collapse to one identical set
    expect(unique.size).toBeGreaterThan(1)
  })

  it('produces only valid, in-range fields', () => {
    for (const id of ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8']) {
      const d = getCardDecorations(id)
      // photo corners: subset of the 4 known corners, unique
      const corners = new Set(d.photoCorners)
      expect(corners.size).toBe(d.photoCorners.length)
      for (const c of d.photoCorners) {
        expect(['tl', 'tr', 'bl', 'br']).toContain(c)
      }
      // washi: 0..2 pieces, each with a known tint + bounded angle + edge
      expect(d.washi.length).toBeGreaterThanOrEqual(0)
      expect(d.washi.length).toBeLessThanOrEqual(2)
      for (const w of d.washi) {
        expect(['a', 'b', 'c']).toContain(w.tint)
        expect(['top', 'right', 'bottom', 'left']).toContain(w.edge)
        expect(w.angleDeg).toBeGreaterThanOrEqual(-14)
        expect(w.angleDeg).toBeLessThanOrEqual(14)
        expect(w.offsetPct).toBeGreaterThanOrEqual(8)
        expect(w.offsetPct).toBeLessThanOrEqual(80)
      }
      // fastener: never both pin AND clip
      expect(!(d.pin && d.clip)).toBe(true)
      // stamp: null or a known variant + corner + bounded angle
      if (d.stamp) {
        expect(['ARCHIVE', 'REAL', 'RATED']).toContain(d.stamp.label)
        expect(['tl', 'tr', 'bl', 'br']).toContain(d.stamp.corner)
        expect(d.stamp.angleDeg).toBeGreaterThanOrEqual(-18)
        expect(d.stamp.angleDeg).toBeLessThanOrEqual(18)
      }
    }
  })
})
