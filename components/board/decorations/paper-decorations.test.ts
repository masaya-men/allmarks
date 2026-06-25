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
    // Values re-derived 2026-06-25 (brushup 4): stamp lost its `label` (word now
    // baked into the PNG) and new iconStamp/wax categories were appended, so the
    // PRNG stream past the stamp roll shifted. washi/pin/clip/photoCorners are
    // unchanged (they precede the stamp). Derived via a throwaway vitest run.
    // Using toEqual + full field pinning to catch PRNG shifts in any field.
    expect(getCardDecorations('bookmark-abc')).toEqual({
      photoCorners: ['tl', 'br'],
      washi: [
        { tint: 'b', edge: 'bottom', angleDeg: 5.6, offsetPct: 69.4, assetSeed: 0.4857295488473028 },
        { tint: 'b', edge: 'right', angleDeg: -8.4, offsetPct: 18.9, assetSeed: 0.12128980527631938 },
      ],
      pin: null,
      clip: false,
      stamp: null,
      iconStamp: { corner: 'tl', angleDeg: 2.9, assetSeed: 0.8656163848936558 },
      wax: null,
    })
    expect(getCardDecorations('card-xyz-7')).toEqual({
      photoCorners: ['tr'],
      washi: [
        { tint: 'a', edge: 'bottom', angleDeg: 5, offsetPct: 15.1, assetSeed: 0.5053368334192783 },
      ],
      pin: null,
      clip: false,
      stamp: null,
      iconStamp: null,
      wax: null,
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
      // washi: 0..2 pieces, each with a known tint + bounded angle + edge + assetSeed
      expect(d.washi.length).toBeGreaterThanOrEqual(0)
      expect(d.washi.length).toBeLessThanOrEqual(2)
      for (const w of d.washi) {
        expect(['a', 'b', 'c']).toContain(w.tint)
        expect(['top', 'right', 'bottom', 'left']).toContain(w.edge)
        expect(w.angleDeg).toBeGreaterThanOrEqual(-14)
        expect(w.angleDeg).toBeLessThanOrEqual(14)
        expect(w.offsetPct).toBeGreaterThanOrEqual(8)
        expect(w.offsetPct).toBeLessThanOrEqual(80)
        expect(typeof w.assetSeed).toBe('number')
        expect(w.assetSeed).toBeGreaterThanOrEqual(0)
        expect(w.assetSeed).toBeLessThan(1)
      }
      // fastener: pin is object|null, clip is boolean; never both truthy
      expect(!(d.pin && d.clip)).toBe(true)
      // pin when present must have a valid variant
      if (d.pin !== null) {
        expect(['gold', 'green']).toContain(d.pin.variant)
      }
      // stamp: null or a corner + bounded angle + assetSeed (word baked into PNG)
      if (d.stamp) {
        expect(['tl', 'tr', 'bl', 'br']).toContain(d.stamp.corner)
        expect(d.stamp.angleDeg).toBeGreaterThanOrEqual(-18)
        expect(d.stamp.angleDeg).toBeLessThanOrEqual(18)
        expect(typeof d.stamp.assetSeed).toBe('number')
        expect(d.stamp.assetSeed).toBeGreaterThanOrEqual(0)
        expect(d.stamp.assetSeed).toBeLessThan(1)
      }
      // icon stamp: null or a corner + bounded angle + assetSeed
      if (d.iconStamp) {
        expect(['tl', 'tr', 'bl', 'br']).toContain(d.iconStamp.corner)
        expect(d.iconStamp.angleDeg).toBeGreaterThanOrEqual(-12)
        expect(d.iconStamp.angleDeg).toBeLessThanOrEqual(12)
        expect(d.iconStamp.assetSeed).toBeGreaterThanOrEqual(0)
        expect(d.iconStamp.assetSeed).toBeLessThan(1)
      }
      // wax: null or a corner + assetSeed
      if (d.wax) {
        expect(['tl', 'tr', 'bl', 'br']).toContain(d.wax.corner)
        expect(d.wax.assetSeed).toBeGreaterThanOrEqual(0)
        expect(d.wax.assetSeed).toBeLessThan(1)
      }
    }
  })

  it('washi pieces carry a stable 0..1 assetSeed', () => {
    const set = getCardDecorations('seed-card-xyz')
    for (const w of set.washi) {
      expect(typeof w.assetSeed).toBe('number')
      expect(w.assetSeed).toBeGreaterThanOrEqual(0)
      expect(w.assetSeed).toBeLessThan(1)
    }
    // determinism
    const again = getCardDecorations('seed-card-xyz')
    expect(again.washi.map((w) => w.assetSeed)).toEqual(set.washi.map((w) => w.assetSeed))
  })

  it('pin (when present) names a color variant', () => {
    // find a card id that produces a pin, then assert the variant union
    let found: ReturnType<typeof getCardDecorations>['pin'] = null
    for (let i = 0; i < 200 && !found; i++) found = getCardDecorations(`pin-probe-${i}`).pin
    expect(found === null || found.variant === 'gold' || found.variant === 'green').toBe(true)
  })
})
