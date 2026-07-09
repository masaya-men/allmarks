import { describe, it, expect } from 'vitest'
import { fillCandidates, snapToFill, DEFAULT_FILL_SNAP_THRESHOLD_PX, currentColumnCount, fillValueAtColumns, snapToFillAtCurrentColumns } from './fill-snap'

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

describe('currentColumnCount', () => {
  it('counts how many uniform cards+gaps fit in the container', () => {
    // width 100, gap 20, container 500 → floor((500+20)/(100+20)) = floor(4.33) = 4
    expect(currentColumnCount(100, 20, 500)).toBe(4)
  })
  it('is at least 1 for a card wider than the container', () => {
    expect(currentColumnCount(600, 20, 500)).toBe(1)
  })
  it('guards zero/negative container or width', () => {
    expect(currentColumnCount(100, 20, 0)).toBe(1)
    expect(currentColumnCount(0, 20, 500)).toBe(1)
  })
})

describe('fillValueAtColumns', () => {
  it('width that fills exactly at N columns (equal L/R margins)', () => {
    // 5 columns, gap 20, container 1180 → (1180 - 4*20)/5 = 220
    expect(fillValueAtColumns(5, 20, 1180, 'width', 120, 720)).toBe(220)
  })
  it('gap that fills exactly at N columns', () => {
    // 5 columns, width 220, container 1180 → (1180 - 5*220)/4 = 20
    expect(fillValueAtColumns(5, 220, 1180, 'gap', 0, 300)).toBe(20)
  })
  it('returns null when the fill value is outside [min,max]', () => {
    expect(fillValueAtColumns(1, 0, 5000, 'width', 120, 720)).toBeNull() // 5000 > max
  })
  it('returns null for gap axis with a single column (gap undefined)', () => {
    expect(fillValueAtColumns(1, 220, 1180, 'gap', 0, 300)).toBeNull()
  })
})

describe('snapToFillAtCurrentColumns', () => {
  const base = { other: 20, containerWidth: 1180, axis: 'width' as const, min: 120, max: 720 }
  it('snaps a near-fill width to the exact fill value at the CURRENT column count', () => {
    // current width 224, gap 20 → N = floor((1180+20)/(224+20)) = floor(4.91) = 4
    // fill at 4 cols = (1180 - 3*20)/4 = 280 — but 224 is far from 280, so NO snap here.
    // Use a width close to its own N's fill: width 216 → N = floor(1200/236)=5, fill@5 = 220, |216-220|=4 → snaps to 220.
    expect(snapToFillAtCurrentColumns({ ...base, value: 216, thresholdPx: 10 })).toBe(220)
  })
  it('does NOT jump to a different column count (5 stays 5, never 4)', () => {
    // width 219 → N=5, fill@5=220 (snaps up to 220), never to fill@4=280.
    const snapped = snapToFillAtCurrentColumns({ ...base, value: 219, thresholdPx: 10 })
    expect(snapped).toBe(220)
    expect(snapped).not.toBe(280)
  })
  it('leaves a value far from its column fill untouched', () => {
    // width 250 → N = floor(1200/270)=4, fill@4=280, |250-280|=30 > threshold → unchanged.
    expect(snapToFillAtCurrentColumns({ ...base, value: 250, thresholdPx: 10 })).toBe(250)
  })
})
