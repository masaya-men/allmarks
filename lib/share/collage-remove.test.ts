import { describe, expect, it } from 'vitest'
import { removeFromCollage } from './collage-remove'

const positions = { a: { x: 0, y: 0, w: 10, h: 10 }, b: { x: 5, y: 5, w: 20, h: 20 } }
const order = ['a', 'b']
const rotations = { a: 0, b: 15 }

describe('removeFromCollage', () => {
  it('removes the id from all three maps', () => {
    const r = removeFromCollage(positions, order, rotations, 'a')
    expect(r.positions).toEqual({ b: { x: 5, y: 5, w: 20, h: 20 } })
    expect(r.order).toEqual(['b'])
    expect(r.rotations).toEqual({ b: 15 })
  })
  it('does not mutate the inputs', () => {
    removeFromCollage(positions, order, rotations, 'a')
    expect(positions).toEqual({ a: { x: 0, y: 0, w: 10, h: 10 }, b: { x: 5, y: 5, w: 20, h: 20 } })
    expect(order).toEqual(['a', 'b'])
    expect(rotations).toEqual({ a: 0, b: 15 })
  })
  it('is a value no-op for an unknown id', () => {
    const r = removeFromCollage(positions, order, rotations, 'z')
    expect(r.positions).toEqual(positions)
    expect(r.order).toEqual(order)
    expect(r.rotations).toEqual(rotations)
  })
})
