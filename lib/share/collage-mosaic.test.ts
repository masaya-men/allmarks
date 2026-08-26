import { describe, it, expect } from 'vitest'
import { fitSelectionMosaic } from './collage-mosaic'

const rect = { x: 0, y: 0, width: 1000, height: 500 }

describe('fitSelectionMosaic', () => {
  it('returns {} for an empty selection', () => {
    expect(fitSelectionMosaic([], rect)).toEqual({})
  })

  it('a single card fills the whole rect (no gap)', () => {
    const pos = fitSelectionMosaic([{ id: 'a', width: 200, height: 100 }], rect, { gap: 0 })
    expect(pos.a).toEqual({ x: 0, y: 0, w: 1000, h: 500 })
  })

  it('covers the full rect area with zero leftover space (no gap)', () => {
    const cards = [
      { id: 'a', width: 200, height: 100 },
      { id: 'b', width: 100, height: 100 },
      { id: 'c', width: 300, height: 150 },
      { id: 'd', width: 150, height: 300 },
      { id: 'e', width: 80, height: 80 },
    ]
    const pos = fitSelectionMosaic(cards, rect, { gap: 0 })
    const totalArea = Object.values(pos).reduce((sum, p) => sum + p.w * p.h, 0)
    expect(totalArea).toBeCloseTo(rect.width * rect.height, 0)
  })

  it('returns a position for every card id, no more and no fewer', () => {
    const cards = [
      { id: 'a', width: 200, height: 100 },
      { id: 'b', width: 100, height: 100 },
      { id: 'c', width: 300, height: 150 },
    ]
    const pos = fitSelectionMosaic(cards, rect, { gap: 0 })
    expect(Object.keys(pos).sort()).toEqual(['a', 'b', 'c'])
  })

  it('every cell stays fully inside the rect', () => {
    const cards = [
      { id: 'a', width: 200, height: 100 },
      { id: 'b', width: 100, height: 100 },
      { id: 'c', width: 300, height: 150 },
      { id: 'd', width: 150, height: 300 },
      { id: 'e', width: 80, height: 80 },
      { id: 'f', width: 400, height: 90 },
      { id: 'g', width: 60, height: 260 },
    ]
    const pos = fitSelectionMosaic(cards, rect, { gap: 0 })
    for (const p of Object.values(pos)) {
      expect(p.x).toBeGreaterThanOrEqual(rect.x - 0.01)
      expect(p.y).toBeGreaterThanOrEqual(rect.y - 0.01)
      expect(p.x + p.w).toBeLessThanOrEqual(rect.x + rect.width + 0.01)
      expect(p.y + p.h).toBeLessThanOrEqual(rect.y + rect.height + 0.01)
    }
  })

  it('a positive gap never insets the OUTER edge — cells on the rect boundary stay flush (no letterbox)', () => {
    // Real CSS `gap` semantics: the gutter is only between cells, never
    // between a cell and the container edge. This matters concretely for
    // the mobile SHARE 9:16 band, which must reach both side edges with no
    // blank margin regardless of gap.
    const cards = [
      { id: 'a', width: 200, height: 100 },
      { id: 'b', width: 100, height: 100 },
      { id: 'c', width: 300, height: 150 },
      { id: 'd', width: 150, height: 300 },
    ]
    const pos = fitSelectionMosaic(cards, rect, { gap: 20 })
    const minX = Math.min(...Object.values(pos).map((p) => p.x))
    const maxRight = Math.max(...Object.values(pos).map((p) => p.x + p.w))
    const minY = Math.min(...Object.values(pos).map((p) => p.y))
    const maxBottom = Math.max(...Object.values(pos).map((p) => p.y + p.h))
    expect(minX).toBeCloseTo(rect.x, 5)
    expect(maxRight).toBeCloseTo(rect.x + rect.width, 5)
    expect(minY).toBeCloseTo(rect.y, 5)
    expect(maxBottom).toBeCloseTo(rect.y + rect.height, 5)
  })

  it('a positive gap removes total covered area (interior gutters), even though outer edges stay flush', () => {
    const cards = [
      { id: 'a', width: 200, height: 100 },
      { id: 'b', width: 100, height: 100 },
      { id: 'c', width: 300, height: 150 },
      { id: 'd', width: 150, height: 300 },
    ]
    const tightArea = Object.values(fitSelectionMosaic(cards, rect, { gap: 0 })).reduce((s, p) => s + p.w * p.h, 0)
    const gappedArea = Object.values(fitSelectionMosaic(cards, rect, { gap: 20 })).reduce((s, p) => s + p.w * p.h, 0)
    expect(gappedArea).toBeLessThan(tightArea)
  })

  it('keeps cells roughly square instead of naive full-width strips', () => {
    // 12 equal-weight cards in a 1000x500 rect: a naive single-row slice
    // would produce ~83x500 cells (aspect ~6:1). A real squarified treemap
    // breaks into multiple rows/columns to stay close to square.
    const cards = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, width: 100, height: 100 }))
    const pos = fitSelectionMosaic(cards, rect, { gap: 0 })
    for (const p of Object.values(pos)) {
      const aspect = Math.max(p.w, p.h) / Math.min(p.w, p.h)
      expect(aspect).toBeLessThan(3)
    }
  })

  it('empty rect (zero width or height) returns {}', () => {
    expect(fitSelectionMosaic([{ id: 'a', width: 200, height: 100 }], { x: 0, y: 0, width: 0, height: 500 })).toEqual({})
    expect(fitSelectionMosaic([{ id: 'a', width: 200, height: 100 }], { x: 0, y: 0, width: 1000, height: 0 })).toEqual({})
  })
})
