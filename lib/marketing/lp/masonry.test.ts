import { describe, it, expect } from 'vitest'
import { masonry } from './masonry'

describe('masonry (greedy shortest column)', () => {
  it('places cards into the shortest column', () => {
    const L = masonry([{ a: 1 }, { a: 2 }, { a: 0.5 }], [0, 1, 2], 210, 2, 10)
    expect(L.cw).toBe(100)
    expect(L.slots[0]).toEqual({ x: 0, y: 0, h: 100 })
    expect(L.slots[1]).toEqual({ x: 110, y: 0, h: 50 })
    expect(L.slots[2]).toEqual({ x: 110, y: 60, h: 200 })
  })
  it('only lays out the ids in order', () => {
    const L = masonry([{ a: 1 }, { a: 1 }, { a: 1 }], [2], 100, 1, 0)
    expect(Object.keys(L.slots)).toEqual(['2'])
  })
})
