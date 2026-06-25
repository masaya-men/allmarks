import { describe, it, expect } from 'vitest'
import { getBoardDecor } from './board-decor'

describe('getBoardDecor', () => {
  it('is deterministic for a given content height', () => {
    expect(getBoardDecor(5000)).toEqual(getBoardDecor(5000))
  })

  it('scatters more items as the board grows taller', () => {
    expect(getBoardDecor(6000).length).toBeGreaterThan(getBoardDecor(1200).length)
  })

  it('returns empty for non-positive / non-finite heights', () => {
    expect(getBoardDecor(0)).toEqual([])
    expect(getBoardDecor(-100)).toEqual([])
    expect(getBoardDecor(Number.NaN)).toEqual([])
  })

  it('every item carries in-range placement fields', () => {
    for (const it of getBoardDecor(8000)) {
      expect(it.xPct).toBeGreaterThanOrEqual(0)
      expect(it.xPct).toBeLessThanOrEqual(100)
      expect(it.yPx).toBeGreaterThanOrEqual(0)
      expect(it.yPx).toBeLessThanOrEqual(8000)
      expect(it.widthPx).toBeGreaterThan(0)
      expect(it.opacity).toBeGreaterThan(0)
      expect(it.opacity).toBeLessThanOrEqual(1)
    }
  })
})
