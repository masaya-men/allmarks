import { describe, it, expect } from 'vitest'
import { computeVirtualOrder } from './use-card-reorder-drag'
import type { BoardItem } from '@/lib/storage/use-board-data'
import type { CardPosition } from '@/lib/board/types'

/**
 * computeVirtualOrder must produce ids in the SAME order the board displays:
 * use-board-data sorts active items DESC by orderIndex (newest-saved at top).
 * Regression guard for the drag bug where it sorted ASC while the board showed
 * DESC — on a stationary grab the preview flipped to the reversed order and
 * cards flickered between old/new order, and the drop persisted inverted.
 */

/** Minimal BoardItem for the order math (only bookmarkId/orderIndex are read). */
function item(id: string, orderIndex: number): BoardItem {
  return { bookmarkId: id, orderIndex, aspectRatio: 1 } as unknown as BoardItem
}

/** Stub layout: stack the given items vertically in array order (y = index*100),
 *  so a card's simulated Y directly encodes its index. */
function stackLayout(ordered: ReadonlyArray<BoardItem>): Readonly<Record<string, CardPosition>> {
  const out: Record<string, CardPosition> = {}
  ordered.forEach((it, i) => {
    out[it.bookmarkId] = { x: 0, y: i * 100, w: 100, h: 100 }
  })
  return out
}

describe('computeVirtualOrder — order direction matches the DESC board display', () => {
  // a=oldest(0), b=1, c=newest(2). Board shows DESC: [c, b, a] top→bottom.
  const items = [item('a', 0), item('b', 1), item('c', 2)]

  it('a stationary grab returns the current DESC order unchanged (no flip)', () => {
    // Drag 'b'. Its current display slot is the middle (DESC index 1 → y=100).
    const order = computeVirtualOrder({
      items,
      draggedId: 'b',
      cardWorldX: 0,
      cardWorldY: 100,
      simulateLayout: stackLayout,
    })
    expect(order).toEqual(['c', 'b', 'a'])
  })

  it('dragging the bottom card to the top yields a DESC-consistent order', () => {
    // 'a' lives at the bottom in DESC (y=200). Drag it up to y=0 (the top slot).
    const order = computeVirtualOrder({
      items,
      draggedId: 'a',
      cardWorldX: 0,
      cardWorldY: 0,
      simulateLayout: stackLayout,
    })
    expect(order[0]).toBe('a')
    // the remaining cards keep their DESC relative order
    expect(order).toEqual(['a', 'c', 'b'])
  })
})
