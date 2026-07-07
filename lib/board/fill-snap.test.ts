import { describe, it, expect } from 'vitest'
import { fillCandidates, snapToFill, DEFAULT_FILL_SNAP_THRESHOLD_PX } from './fill-snap'

// The user's own board: 1489 CSS viewport → containerWidth 1489 − 2·9 = 1471.
const CONTAINER = 1471
const W_MIN = 120
const W_MAX = 720
const G_MIN = 0
const G_MAX = 300

describe('fillCandidates — width axis', () => {
  it('enumerates the exact-fill widths for each column count (gap fixed)', () => {
    const gap = 97.21
    const cands = fillCandidates(gap, CONTAINER, 'width', W_MIN, W_MAX)
    // N=2 → 686.9, N=3 → 425.53, N=4 → 294.84, N=5 → 216.43, N=6 → 164.16, N=7 → 126.82.
    // N=1 (1471) exceeds W_MAX; N=8 (98.8) is below W_MIN → excluded.
    expect(cands.length).toBe(6)
    // Ascending order.
    expect(cands).toEqual([...cands].sort((a, b) => a - b))
    // Every candidate produces zero right-edge leftover for its N.
    for (const w of cands) {
      const n = Math.round((CONTAINER + gap) / (w + gap))
      expect(n * w + (n - 1) * gap).toBeCloseTo(CONTAINER, 4)
      expect(w).toBeGreaterThanOrEqual(W_MIN)
      expect(w).toBeLessThanOrEqual(W_MAX)
    }
    // 4-column fill for this gap is ~294.84.
    expect(cands.some((w) => Math.abs(w - 294.84) < 0.1)).toBe(true)
  })

  it('handles a zero gap (widthₙ = containerWidth / N)', () => {
    const cands = fillCandidates(0, CONTAINER, 'width', W_MIN, W_MAX)
    // N=3 → 490.33, N=4 → 367.75, …, down to min. N=2 (735.5) > max.
    for (const w of cands) {
      const n = Math.round(CONTAINER / w)
      expect(n * w).toBeCloseTo(CONTAINER, 4)
    }
  })
})

describe('fillCandidates — gap axis', () => {
  it('enumerates the exact-fill gaps for each column count (width fixed)', () => {
    const width = 267.84 // DEFAULT width
    const cands = fillCandidates(width, CONTAINER, 'gap', G_MIN, G_MAX)
    // N=4 → 133.21, N=5 → 32.95. N=3 (333.74) > G_MAX; N=6 negative → excluded.
    expect(cands.length).toBe(2)
    for (const g of cands) {
      const n = Math.round((CONTAINER - g) / (width + g)) + 0 // not used for check below
      void n
    }
    expect(cands.some((g) => Math.abs(g - 133.21) < 0.1)).toBe(true)
    expect(cands.some((g) => Math.abs(g - 32.95) < 0.1)).toBe(true)
    for (const g of cands) {
      expect(g).toBeGreaterThanOrEqual(G_MIN)
      expect(g).toBeLessThanOrEqual(G_MAX)
    }
  })
})

describe('fillCandidates — degenerate', () => {
  it('returns empty for non-positive container width', () => {
    expect(fillCandidates(97, 0, 'width', W_MIN, W_MAX)).toEqual([])
    expect(fillCandidates(97, -5, 'gap', G_MIN, G_MAX)).toEqual([])
  })
})

describe('snapToFill', () => {
  it('snaps a width released just under the threshold', () => {
    const gap = 97.21
    // 4-column fill ≈ 294.84; 291 is 3.84 px away (< 10 px default).
    const snapped = snapToFill({
      value: 291,
      other: gap,
      containerWidth: CONTAINER,
      axis: 'width',
      min: W_MIN,
      max: W_MAX,
    })
    expect(snapped).toBeCloseTo(294.84, 1)
  })

  it('leaves a width that is far from every candidate untouched', () => {
    const gap = 97.21
    // 267.84 (DEFAULT) is ~27 px from the nearest fill (294.84) → no snap.
    const snapped = snapToFill({
      value: 267.84,
      other: gap,
      containerWidth: CONTAINER,
      axis: 'width',
      min: W_MIN,
      max: W_MAX,
    })
    expect(snapped).toBe(267.84)
  })

  it('snaps a gap released near a fill gap', () => {
    const width = 267.84
    const snapped = snapToFill({
      value: 130,
      other: width,
      containerWidth: CONTAINER,
      axis: 'gap',
      min: G_MIN,
      max: G_MAX,
    })
    expect(snapped).toBeCloseTo(133.21, 1)
  })

  it('respects a custom threshold', () => {
    const gap = 97.21
    // 291 is 3.84 px from 294.84 — inside default 10, outside a tight 2.
    expect(
      snapToFill({ value: 291, other: gap, containerWidth: CONTAINER, axis: 'width', min: W_MIN, max: W_MAX, thresholdPx: 2 }),
    ).toBe(291)
  })

  it('returns the value unchanged when there are no candidates', () => {
    expect(
      snapToFill({ value: 300, other: 97, containerWidth: 0, axis: 'width', min: W_MIN, max: W_MAX }),
    ).toBe(300)
  })

  it('exposes a sane default threshold', () => {
    expect(DEFAULT_FILL_SNAP_THRESHOLD_PX).toBeGreaterThan(0)
  })
})
