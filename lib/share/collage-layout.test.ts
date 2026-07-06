import { describe, it, expect } from 'vitest'
import { seedCollagePositions, moveElement, resizeElement, bringToFront } from './collage-layout'

const cards = [
  { id: 'a', width: 200, height: 100 },
  { id: 'b', width: 200, height: 100 },
]

describe('collage-layout', () => {
  it('seedCollagePositions returns a position for every card', () => {
    const pos = seedCollagePositions(cards, 1000, 10)
    expect(Object.keys(pos).sort()).toEqual(['a', 'b'])
    expect(pos.a).toMatchObject({ x: expect.any(Number), y: expect.any(Number), w: 200, h: 100 })
  })

  it('moveElement sets absolute x/y without touching size', () => {
    const pos = seedCollagePositions(cards, 1000, 10)
    const moved = moveElement(pos, 'a', 333, 444)
    expect(moved.a).toMatchObject({ x: 333, y: 444, w: pos.a.w, h: pos.a.h })
    expect(moved.b).toEqual(pos.b)
  })

  it('resizeElement clamps to 80px min and preserves aspect', () => {
    const pos = seedCollagePositions(cards, 1000, 10) // a = 200x100, aspect 2
    const small = resizeElement(pos, 'a', 40)
    expect(small.a.w).toBe(80)
    expect(small.a.h).toBe(40) // 80 / 2
    const big = resizeElement(pos, 'a', 400)
    expect(big.a).toMatchObject({ w: 400, h: 200 })
  })

  it('moveElement / resizeElement are no-ops for unknown id', () => {
    const pos = seedCollagePositions(cards, 1000, 10)
    expect(moveElement(pos, 'zzz', 1, 1)).toBe(pos)
    expect(resizeElement(pos, 'zzz', 100)).toBe(pos)
  })

  it('bringToFront moves the id to the end of the order', () => {
    expect(bringToFront(['a', 'b', 'c'], 'a')).toEqual(['b', 'c', 'a'])
    expect(bringToFront(['a', 'b'], 'zzz')).toEqual(['a', 'b'])
  })
})
