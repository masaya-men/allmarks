import { describe, it, expect } from 'vitest'
import { normalizeRect, rectsIntersect, idsWithinRect, type Rect } from './marquee-select'

describe('normalizeRect', () => {
  it('drag down-right: coordinates already in order', () => {
    expect(normalizeRect(10, 20, 100, 200)).toEqual({ left: 10, top: 20, right: 100, bottom: 200 })
  })

  it('drag up-left: swaps so left<=right and top<=bottom', () => {
    expect(normalizeRect(100, 200, 10, 20)).toEqual({ left: 10, top: 20, right: 100, bottom: 200 })
  })

  it('drag up-right / down-left: mixed axes', () => {
    expect(normalizeRect(100, 20, 10, 200)).toEqual({ left: 10, top: 20, right: 100, bottom: 200 })
  })
})

describe('rectsIntersect', () => {
  const card: Rect = { left: 50, top: 50, right: 150, bottom: 150 }

  it('overlapping rects intersect', () => {
    expect(rectsIntersect({ left: 0, top: 0, right: 100, bottom: 100 }, card)).toBe(true)
  })

  it('a rect fully containing the other intersects', () => {
    expect(rectsIntersect({ left: 0, top: 0, right: 300, bottom: 300 }, card)).toBe(true)
  })

  it('a rect fully inside the other intersects (order-independent)', () => {
    expect(rectsIntersect(card, { left: 0, top: 0, right: 300, bottom: 300 })).toBe(true)
  })

  it('disjoint rects (no overlap) do not intersect', () => {
    expect(rectsIntersect({ left: 200, top: 200, right: 300, bottom: 300 }, card)).toBe(false)
  })

  it('merely touching edges (no area overlap) do not intersect', () => {
    expect(rectsIntersect({ left: 0, top: 0, right: 50, bottom: 50 }, card)).toBe(false)
  })

  it('a zero-size marquee (just after mousedown, before any movement) over empty space never intersects', () => {
    expect(rectsIntersect({ left: 0, top: 0, right: 0, bottom: 0 }, card)).toBe(false)
  })
})

describe('idsWithinRect', () => {
  const cards = [
    { bookmarkId: 'a', rect: { left: 0, top: 0, right: 100, bottom: 100 } },
    { bookmarkId: 'b', rect: { left: 200, top: 200, right: 300, bottom: 300 } },
    { bookmarkId: 'c', rect: { left: 50, top: 50, right: 150, bottom: 150 } },
  ]

  it('returns only the ids whose card rect intersects the marquee, in input order', () => {
    const rect = normalizeRect(0, 0, 120, 120)
    expect(idsWithinRect(rect, cards)).toEqual(['a', 'c'])
  })

  it('empty marquee (no cards touched) returns an empty array', () => {
    const rect = normalizeRect(500, 500, 600, 600)
    expect(idsWithinRect(rect, cards)).toEqual([])
  })

  it('a marquee covering everything returns all ids', () => {
    const rect = normalizeRect(0, 0, 1000, 1000)
    expect(idsWithinRect(rect, cards)).toEqual(['a', 'b', 'c'])
  })
})
