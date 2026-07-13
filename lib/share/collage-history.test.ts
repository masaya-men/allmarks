import { describe, expect, it } from 'vitest'
import { snapshotsEqual, pushSnapshot, MAX_COLLAGE_HISTORY, type CollageSnapshot } from './collage-history'

const snap = (order: string[], x = 0): CollageSnapshot => ({
  positions: Object.fromEntries(order.map((id) => [id, { x, y: 0, w: 10, h: 10 }])),
  order,
  rotations: Object.fromEntries(order.map((id) => [id, 0])),
})

describe('snapshotsEqual', () => {
  it('is true for value-equal snapshots with different references', () => {
    expect(snapshotsEqual(snap(['a', 'b']), snap(['a', 'b']))).toBe(true)
  })
  it('is false when order differs', () => {
    expect(snapshotsEqual(snap(['a', 'b']), snap(['b', 'a']))).toBe(false)
  })
  it('is false when a position value differs', () => {
    expect(snapshotsEqual(snap(['a'], 0), snap(['a'], 5))).toBe(false)
  })
  it('is false when a card is removed', () => {
    expect(snapshotsEqual(snap(['a', 'b']), snap(['a']))).toBe(false)
  })
})

describe('pushSnapshot', () => {
  it('appends to the stack', () => {
    expect(pushSnapshot([], snap(['a']), MAX_COLLAGE_HISTORY)).toHaveLength(1)
  })
  it('drops the oldest when over max', () => {
    let stack: CollageSnapshot[] = []
    for (let i = 0; i < MAX_COLLAGE_HISTORY + 5; i++) stack = pushSnapshot(stack, snap([`c${i}`]), MAX_COLLAGE_HISTORY)
    expect(stack).toHaveLength(MAX_COLLAGE_HISTORY)
    expect(stack[0]?.order).toEqual(['c5'])
  })
})
