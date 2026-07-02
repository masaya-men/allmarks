import { describe, it, expect } from 'vitest'
import { computeVirtualOrder, pressLandsOnCardScrollbar } from './use-card-reorder-drag'
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

/**
 * pressLandsOnCardScrollbar — a press on a text card's internal scroll region
 * ([data-card-scroll]) scrollbar gutter must be recognised so the card drag
 * hook can bail (native scrollbar handles it) instead of capturing the pointer.
 * Capturing both hijacked the native scroll AND mis-fired a card click that
 * opened the Lightbox (Playwright-confirmed). Pressing the CONTENT must still
 * return false so tapping the text opens the card.
 */
function makeScroller(opts: {
  rectLeft: number
  rectTop: number
  clientWidth: number
  clientHeight: number
  scrollHeight: number
  scrollWidth?: number
  clientLeft?: number
  clientTop?: number
  /** Scrollbar layout width. 4 (default) = classic space-taking scrollbar;
   *  0 = overlay scrollbar (auto-hide setting) that takes no layout width. */
  scrollbar?: number
}): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('data-card-scroll', 'true')
  const scrollbar = opts.scrollbar ?? 4
  const def = (k: string, v: number): void => {
    Object.defineProperty(el, k, { value: v, configurable: true })
  }
  def('clientWidth', opts.clientWidth)
  def('clientHeight', opts.clientHeight)
  def('clientLeft', opts.clientLeft ?? 0)
  def('clientTop', opts.clientTop ?? 0)
  def('scrollHeight', opts.scrollHeight)
  def('scrollWidth', opts.scrollWidth ?? opts.clientWidth)
  // Outer box = client box + scrollbar gutter. Overlay scrollbars add nothing.
  def('offsetWidth', opts.clientWidth + (opts.clientLeft ?? 0) + scrollbar)
  def('offsetHeight', opts.clientHeight + (opts.clientTop ?? 0) + scrollbar)
  el.getBoundingClientRect = (): DOMRect =>
    ({
      left: opts.rectLeft,
      top: opts.rectTop,
      right: opts.rectLeft + opts.clientWidth + (opts.clientLeft ?? 0) + scrollbar,
      bottom: opts.rectTop + opts.clientHeight + (opts.clientTop ?? 0) + scrollbar,
      width: opts.clientWidth + (opts.clientLeft ?? 0) + scrollbar,
      height: opts.clientHeight + (opts.clientTop ?? 0) + scrollbar,
      x: opts.rectLeft,
      y: opts.rectTop,
      toJSON: () => ({}),
    }) as DOMRect
  return el
}

describe('pressLandsOnCardScrollbar', () => {
  // Mirrors the repro: 280px card, 4px right scrollbar → clientWidth 276.
  const overflowing = {
    rectLeft: 80,
    rectTop: 80,
    clientWidth: 276,
    clientHeight: 196,
    scrollHeight: 900, // > clientHeight → vertical scrollbar present
  }

  it('returns true for a press in the vertical scrollbar gutter', () => {
    const el = makeScroller(overflowing)
    // Gutter left = 80 + 0 + 276 = 356; press at 358 is inside the 4px gutter.
    expect(pressLandsOnCardScrollbar(el, 358, 150)).toBe(true)
  })

  it('returns false for a press on the text content', () => {
    const el = makeScroller(overflowing)
    expect(pressLandsOnCardScrollbar(el, 120, 150)).toBe(false)
  })

  it('returns false when the region does not overflow (no scrollbar), even at the far right', () => {
    const el = makeScroller({ ...overflowing, scrollHeight: 100 }) // <= clientHeight
    expect(pressLandsOnCardScrollbar(el, 358, 150)).toBe(false)
  })

  it('resolves the [data-card-scroll] ancestor from a child target', () => {
    const el = makeScroller(overflowing)
    const child = document.createElement('span')
    el.appendChild(child)
    expect(pressLandsOnCardScrollbar(child, 358, 150)).toBe(true)
  })

  it('returns false when there is no [data-card-scroll] ancestor', () => {
    const plain = document.createElement('div')
    expect(pressLandsOnCardScrollbar(plain, 358, 150)).toBe(false)
  })

  it('returns false for a null target', () => {
    expect(pressLandsOnCardScrollbar(null, 358, 150)).toBe(false)
  })

  it('classic mode: a press on the padding (inside the client box) still opens the card', () => {
    // Classic gutter starts at 356; a press at 350 is padding, not the scrollbar.
    // Target is the container (padding hit-tests as the scroller) but classic
    // geometry must NOT bail there.
    const el = makeScroller(overflowing) // scrollbar defaults to 4 (classic)
    expect(pressLandsOnCardScrollbar(el, 350, 150)).toBe(false)
  })

  describe('overlay scrollbar mode (auto-hide, zero layout width)', () => {
    const overlay = { ...overflowing, clientWidth: 280, scrollbar: 0 }

    it('bails when the press hit-tests as the scroll container (gutter/padding)', () => {
      const el = makeScroller(overlay)
      // Overlay scrollbar floats over the right edge; the press targets the
      // container itself. Geometry can't see it, target-fallback must catch it.
      expect(pressLandsOnCardScrollbar(el, 358, 150)).toBe(true)
    })

    it('still opens the card when the press hits a content child', () => {
      const el = makeScroller(overlay)
      const child = document.createElement('span')
      el.appendChild(child)
      expect(pressLandsOnCardScrollbar(child, 358, 150)).toBe(false)
    })
  })
})

describe('computeVirtualOrder — windowed search stays correct beyond the radius', () => {
  // 120 cards (orderIndex 0..119). DESC display top→bottom: [119, 118, ..., 0].
  const many = Array.from({ length: 120 }, (_, i) => item(`c${i}`, i))

  it('falls back to a full scan when the target is outside the search window', () => {
    // Drag c60 (DESC index = 119-60 = 59). searchCenter omitted → centers on 59,
    // window ≈ [11, 107]. Drop target is the very top (y=0, index 0) — OUTSIDE the
    // window. The edge-fallback full scan must still place it first.
    const order = computeVirtualOrder({
      items: many,
      draggedId: 'c60',
      cardWorldX: 0,
      cardWorldY: 0,
      simulateLayout: stackLayout,
    })
    expect(order[0]).toBe('c60')
    expect(order.length).toBe(120)
  })

  it('windowed result matches a near-center drop without needing the fallback', () => {
    // c60 is at DESC index 59 (y≈5900). Nudge it one slot up (y≈5800 → index 58).
    const order = computeVirtualOrder({
      items: many,
      draggedId: 'c60',
      cardWorldX: 0,
      cardWorldY: 58 * 100,
      simulateLayout: stackLayout,
      searchCenter: 59,
    })
    expect(order.indexOf('c60')).toBe(58)
  })
})
