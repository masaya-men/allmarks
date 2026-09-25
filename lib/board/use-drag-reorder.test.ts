import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, cleanup, fireEvent } from '@testing-library/react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useDragReorder } from './use-drag-reorder'

/** Builds a fake React pointerdown event — the hook only reads `.button`,
 *  `.pointerType`, `.clientX`, `.clientY` off it, so a plain object cast
 *  stands in for the full SyntheticEvent. */
function pointerDownEvent(overrides: {
  pointerType: 'mouse' | 'touch' | 'pen'
  clientX?: number
  clientY?: number
  button?: number
}): ReactPointerEvent<HTMLElement> {
  return {
    button: overrides.button ?? 0,
    pointerType: overrides.pointerType,
    clientX: overrides.clientX ?? 0,
    clientY: overrides.clientY ?? 0,
  } as unknown as ReactPointerEvent<HTMLElement>
}

/** Two rows, id 'a' above 'b', with real (stubbed) rects so
 *  gapIndexFromRects / computeReorder produce an actual, assertable order
 *  change — jsdom's default getBoundingClientRect is all-zero, which would
 *  make every drag a same-slot no-op. */
function makeRows(): { container: HTMLDivElement } {
  const container = document.createElement('div')
  container.getBoundingClientRect = () =>
    ({ left: 0, right: 100, top: 0, bottom: 200, width: 100, height: 200, x: 0, y: 0, toJSON: () => {} }) as DOMRect
  const rowA = document.createElement('button')
  rowA.setAttribute('data-tag-id', 'a')
  rowA.getBoundingClientRect = () =>
    ({ left: 0, right: 100, top: 0, bottom: 30, width: 100, height: 30, x: 0, y: 0, toJSON: () => {} }) as DOMRect
  const rowB = document.createElement('button')
  rowB.setAttribute('data-tag-id', 'b')
  rowB.getBoundingClientRect = () =>
    ({ left: 0, right: 100, top: 30, bottom: 60, width: 100, height: 30, x: 0, y: 0, toJSON: () => {} }) as DOMRect
  container.appendChild(rowA)
  container.appendChild(rowB)
  document.body.appendChild(container)
  return { container }
}

describe('useDragReorder — touch long-press gate (mobile filter-dropdown swipe fix)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('touch: a swipe shorter than the 400ms long-press never arms — no reorder call, no preventDefault (native scroll stays live)', () => {
    const { container } = makeRows()
    const onReorder = vi.fn()
    const { result } = renderHook(() =>
      useDragReorder({ axis: 'y', ids: ['a', 'b'], onReorder, getScrollEl: () => container, getItemsEl: () => container }),
    )

    act(() => {
      result.current.onItemPointerDown('a', pointerDownEvent({ pointerType: 'touch', clientY: 0 }))
    })
    // Finger moves down (a normal scroll swipe) well before 400ms elapses.
    const notCancelled = fireEvent.pointerMove(window, { clientX: 0, clientY: 40, cancelable: true })
    expect(notCancelled).toBe(true) // preventDefault was NOT called
    expect(result.current.isDragging).toBe(false)

    act(() => {
      vi.advanceTimersByTime(300) // released at 300ms, before the 400ms timer
    })
    fireEvent.pointerUp(window, { clientX: 0, clientY: 40 })

    // Even if a stray timer were still pending, letting time pass must not
    // retroactively arm a drag after release.
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(onReorder).not.toHaveBeenCalled()
    expect(result.current.isDragging).toBe(false)
  })

  it('touch: holding still for 400ms arms the drag (picked-up visual), then movement reorders', () => {
    const { container } = makeRows()
    const onReorder = vi.fn()
    const { result } = renderHook(() =>
      useDragReorder({ axis: 'y', ids: ['a', 'b'], onReorder, getScrollEl: () => container, getItemsEl: () => container }),
    )

    act(() => {
      result.current.onItemPointerDown('a', pointerDownEvent({ pointerType: 'touch', clientY: 0 }))
    })
    expect(result.current.isDragging).toBe(false)

    act(() => {
      vi.advanceTimersByTime(400) // long-press fires
    })
    // Armed: the row already carries the "grabbed" visual before any motion.
    expect(result.current.isDragging).toBe(true)
    expect(result.current.drag?.id).toBe('a')

    // Now movement drives the reorder exactly like the mouse path does once
    // dragging — past row b's midpoint (45) moves 'a' below 'b'.
    const notCancelled = fireEvent.pointerMove(window, { clientX: 0, clientY: 45, cancelable: true })
    expect(notCancelled).toBe(false) // preventDefault called now that we're dragging
    fireEvent.pointerUp(window, { clientX: 0, clientY: 45 })

    expect(onReorder).toHaveBeenCalledWith(['b', 'a'])
  })

  it('touch: moving past 8px before the long-press timer fires cancels the pending press for good', () => {
    const { container } = makeRows()
    const onReorder = vi.fn()
    const { result } = renderHook(() =>
      useDragReorder({ axis: 'y', ids: ['a', 'b'], onReorder, getScrollEl: () => container, getItemsEl: () => container }),
    )

    act(() => {
      result.current.onItemPointerDown('a', pointerDownEvent({ pointerType: 'touch', clientY: 0 }))
    })
    fireEvent.pointerMove(window, { clientX: 0, clientY: 20 }) // > TOUCH_CANCEL_MOVE_PX (8)

    act(() => {
      vi.advanceTimersByTime(1000) // the long-press timer was cleared — must not still fire
    })
    expect(result.current.isDragging).toBe(false)

    fireEvent.pointerUp(window, { clientX: 0, clientY: 20 })
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('mouse: unchanged — 6px threshold arms immediately, no long-press wait', () => {
    const { container } = makeRows()
    const onReorder = vi.fn()
    const { result } = renderHook(() =>
      useDragReorder({ axis: 'y', ids: ['a', 'b'], onReorder, getScrollEl: () => container, getItemsEl: () => container }),
    )

    act(() => {
      result.current.onItemPointerDown('a', pointerDownEvent({ pointerType: 'mouse', clientY: 0 }))
    })
    // Sub-threshold move: still just a click-in-waiting.
    fireEvent.pointerMove(window, { clientX: 0, clientY: 3 })
    expect(result.current.isDragging).toBe(false)

    // No timer needed — time passing alone must not arm a mouse drag either.
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.isDragging).toBe(false)

    // Past the 6px threshold: drags immediately.
    const notCancelled = fireEvent.pointerMove(window, { clientX: 0, clientY: 45 })
    expect(notCancelled).toBe(false)
    expect(result.current.isDragging).toBe(true)

    fireEvent.pointerUp(window, { clientX: 0, clientY: 45 })
    expect(onReorder).toHaveBeenCalledWith(['b', 'a'])
  })

  it('a quick tap (pointerup with no movement) never calls onReorder, on touch or mouse', () => {
    const { container } = makeRows()
    const onReorderTouch = vi.fn()
    const touchHook = renderHook(() =>
      useDragReorder({ axis: 'y', ids: ['a', 'b'], onReorder: onReorderTouch, getScrollEl: () => container, getItemsEl: () => container }),
    )
    act(() => {
      touchHook.result.current.onItemPointerDown('a', pointerDownEvent({ pointerType: 'touch', clientY: 0 }))
    })
    fireEvent.pointerUp(window, { clientX: 0, clientY: 0 })
    expect(onReorderTouch).not.toHaveBeenCalled()
    expect(touchHook.result.current.shouldSuppressClick()).toBe(false)
  })
})
