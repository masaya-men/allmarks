import { describe, it, expect } from 'vitest'
import { computeReorder } from '@/lib/board/reorder'

describe('computeReorder', () => {
  const ids = ['a', 'b', 'c', 'd']

  it('moves the first item to the end (gap = length)', () => {
    expect(computeReorder(ids, 'a', 4)).toEqual(['b', 'c', 'd', 'a'])
  })

  it('moves the first item down between b and c (gap = 2)', () => {
    expect(computeReorder(ids, 'a', 2)).toEqual(['b', 'a', 'c', 'd'])
  })

  it('moves the last item to the front (gap = 0)', () => {
    expect(computeReorder(ids, 'd', 0)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('moves the last item up between a and b (gap = 1)', () => {
    expect(computeReorder(ids, 'd', 1)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('is a no-op when dropped on its own slot (gap = fromIndex)', () => {
    expect(computeReorder(ids, 'b', 1)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('is a no-op when dropped just after itself (gap = fromIndex + 1)', () => {
    expect(computeReorder(ids, 'b', 2)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('clamps a gap beyond the list length', () => {
    expect(computeReorder(ids, 'b', 99)).toEqual(['a', 'c', 'd', 'b'])
  })

  it('returns a copy when the dragged id is absent', () => {
    const out = computeReorder(ids, 'zzz', 2)
    expect(out).toEqual(ids)
    expect(out).not.toBe(ids)
  })

  it('never mutates the input array', () => {
    const input = [...ids]
    computeReorder(input, 'a', 3)
    expect(input).toEqual(['a', 'b', 'c', 'd'])
  })
})
