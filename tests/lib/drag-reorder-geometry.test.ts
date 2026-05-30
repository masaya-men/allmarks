import { describe, it, expect } from 'vitest'
import { gapIndexFromRects, type ItemRect } from '@/lib/board/drag-reorder-geometry'
import { computeReorder } from '@/lib/board/reorder'

/** Build 4 horizontal items, each 100px wide, laid out left→right from x=0. */
function hRects(ids: string[]): ItemRect[] {
  return ids.map((id, i) => ({ id, left: i * 100, right: i * 100 + 100, top: 0, bottom: 30 }))
}
/** Build 4 vertical items, each 30px tall, laid out top→bottom from y=0. */
function vRects(ids: string[]): ItemRect[] {
  return ids.map((id, i) => ({ id, left: 0, right: 100, top: i * 30, bottom: i * 30 + 30 }))
}

const IDS = ['a', 'b', 'c', 'd']

describe('gapIndexFromRects — dragged item is excluded (root-cause fix)', () => {
  it('dragging the FIRST item rightward lands it among later items (not a no-op)', () => {
    // 'a' is grabbed and translated right; pointer sits at x=250 (over c's slot).
    const gap = gapIndexFromRects(hRects(IDS), 250, 'x', 'a')
    // first non-dragged item whose mid (b=150, c=250, d=350) is past 250 → d at index 3
    expect(gap).toBe(3)
    expect(computeReorder(IDS, 'a', gap)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('dragging the LAST item leftward inserts it early', () => {
    const gap = gapIndexFromRects(hRects(IDS), 50, 'x', 'd')
    // a mid=50 (not <50), b mid=150 (>50) → index 1
    expect(gap).toBe(1)
    expect(computeReorder(IDS, 'd', gap)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('pointer past every item → gap = length (drop at the end)', () => {
    const gap = gapIndexFromRects(hRects(IDS), 9999, 'x', 'a')
    expect(gap).toBe(IDS.length)
    expect(computeReorder(IDS, 'a', gap)).toEqual(['b', 'c', 'd', 'a'])
  })

  it('dragging the FIRST item to the far left is a no-op (stays first)', () => {
    const gap = gapIndexFromRects(hRects(IDS), -50, 'x', 'a')
    // b is first non-dragged with mid(150) > -50 → index 1
    expect(gap).toBe(1)
    expect(computeReorder(IDS, 'a', gap)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('vertical axis: dragging the FIRST item downward lands it among later items', () => {
    // 'a' grabbed, pointer at y=75 (over c's slot, mids b=45,c=75,d=105)
    const gap = gapIndexFromRects(vRects(IDS), 76, 'y', 'a')
    expect(gap).toBe(3)
    expect(computeReorder(IDS, 'a', gap)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('vertical axis: dragging a middle item upward inserts it earlier', () => {
    const gap = gapIndexFromRects(vRects(IDS), 20, 'y', 'c')
    // a mid=15 (not <20), b mid=45 (>20) → index 1
    expect(gap).toBe(1)
    expect(computeReorder(IDS, 'c', gap)).toEqual(['a', 'c', 'b', 'd'])
  })

  it('models the real bug: dragged item rect is TRANSLATED under the pointer', () => {
    // The grabbed 'a' has been translated right so its live rect (210..310,
    // mid 260) sits under the pointer at 250. Its siblings keep their resting
    // rects. Without the skip, the loop would hit 'a' first and return 0 (its
    // own index → no-op). The skip makes it land correctly among the siblings.
    const rects: ItemRect[] = [
      { id: 'a', left: 210, right: 310, top: 0, bottom: 30 }, // dragged, shifted
      { id: 'b', left: 100, right: 200, top: 0, bottom: 30 },
      { id: 'c', left: 200, right: 300, top: 0, bottom: 30 },
      { id: 'd', left: 300, right: 400, top: 0, bottom: 30 },
    ]
    const gap = gapIndexFromRects(rects, 250, 'x', 'a')
    // skip a; b mid150 (no), c mid250 (250<250 no), d mid350 (yes) → 3
    expect(gap).toBe(3)
    expect(computeReorder(IDS, 'a', gap)).toEqual(['b', 'c', 'a', 'd'])
  })
})
