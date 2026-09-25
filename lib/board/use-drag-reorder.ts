'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { computeReorder } from './reorder'
import { gapIndexFromRects, type ItemRect, type ReorderAxis } from './drag-reorder-geometry'

/** Movement (px) before a press becomes a drag. Below this, the press is a
 *  plain click (filter toggle / arm). No long-press wait — grab and move.
 *  Mouse / pen only — touch uses the long-press gate below so a vertical
 *  swipe scrolls the list instead of immediately grabbing a row. */
const DRAG_THRESHOLD_PX = 6
/** Touch only: how long a still press must be held before it arms into a
 *  drag. Below this, native scrolling is left alone (no preventDefault). */
const TOUCH_LONG_PRESS_MS = 400
/** Touch only: movement past this many px before the long-press timer fires
 *  cancels the pending press — the finger is scrolling, not reordering. */
const TOUCH_CANCEL_MOVE_PX = 8
/** Pointer within this many px of the scroll container's edge auto-scrolls. */
const AUTOSCROLL_EDGE_PX = 56
/** Max px per frame at the very edge; scales down with distance from the edge. */
const AUTOSCROLL_MAX_STEP = 16

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)

export type DragReorderState = {
  /** Id of the grabbed item. */
  readonly id: string
  /** Translate offset (px) along the axis to glue the item to the pointer
   *  (scroll-compensated so it stays put while the strip auto-scrolls). */
  readonly offset: number
  /** Insertion gap `[0 .. ids.length]` where the item will drop. */
  readonly gapIndex: number
}

/**
 * Direct (handle-less) drag-to-reorder, shared by the vertical filter dropdown
 * and the horizontal triage chip strip. Press an item and move past a small
 * threshold to drag it; a press that doesn't move stays a click. The pointer
 * near a scroll edge auto-scrolls the strip so items off-screen are reachable.
 *
 * Window pointer listeners (attached once for the hook's lifetime) drive the
 * gesture — NO setPointerCapture, which Playwright and some touch paths reject.
 * All inputs are read through refs so the listeners never go stale and never
 * need re-binding.
 */
export function useDragReorder({
  axis,
  ids,
  onReorder,
  getScrollEl,
  getItemsEl,
}: {
  axis: ReorderAxis
  ids: readonly string[]
  onReorder: ((orderedIds: string[]) => void) | undefined
  /** The scrollable container (drives auto-scroll). */
  getScrollEl: () => HTMLElement | null
  /** The element holding the `[data-tag-id]` items (drives hit-testing).
   *  Often the same node as the scroll element. */
  getItemsEl: () => HTMLElement | null
}): {
  drag: DragReorderState | null
  isDragging: boolean
  /** Attach to each reorderable item (the whole row/chip is the handle). */
  onItemPointerDown: (id: string, e: ReactPointerEvent<HTMLElement>) => void
  /** Call at the top of the item's onClick: true = this click ended a drag,
   *  swallow it (don't toggle / arm). */
  shouldSuppressClick: () => boolean
} {
  const [drag, setDrag] = useState<DragReorderState | null>(null)

  // Latest props / getters, read through refs so the window handlers stay
  // stable. Synced in an effect (not during render) to satisfy react-hooks.
  const axisRef = useRef(axis)
  const idsRef = useRef(ids)
  const onReorderRef = useRef(onReorder)
  const getScrollElRef = useRef(getScrollEl)
  const getItemsElRef = useRef(getItemsEl)
  useEffect(() => {
    axisRef.current = axis
    idsRef.current = ids
    onReorderRef.current = onReorder
    getScrollElRef.current = getScrollEl
    getItemsElRef.current = getItemsEl
  })

  // Gesture bookkeeping.
  const pendingRef = useRef<{
    id: string
    startAlong: number
    scrollStart: number
    /** Raw PointerEvent.pointerType from the initiating pointerdown ('mouse'
     *  | 'pen' | 'touch' | ''). Governs which arming rule applies below. */
    pointerType: string
    /** True once the press has armed into a drag. Mouse/pen arm immediately
     *  (armed at creation); touch arms only after the long-press timer fires. */
    armed: boolean
    /** Touch only: the pending long-press timer id, so a move-cancel or an
     *  early pointerup can clear it before it fires. */
    longPressTimer: ReturnType<typeof setTimeout> | null
  } | null>(null)
  const draggingRef = useRef(false)
  const suppressClickRef = useRef(false)
  const lastClientRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const latestDragRef = useRef<DragReorderState | null>(null)
  /** Set by the window-listener effect below so onItemPointerDown's touch
   *  long-press timer (a separate callback) can trigger the same "picked up
   *  in place" visual the mouse/pen path gets from its first recompute(). */
  const recomputeRef = useRef<() => void>(() => {})

  const along = useCallback((x: number, y: number): number => (axisRef.current === 'x' ? x : y), [])
  const scrollOf = useCallback((el: HTMLElement): number => (axisRef.current === 'x' ? el.scrollLeft : el.scrollTop), [])

  // Window listeners are attached once; every dependency is a ref, so the
  // closures never go stale and never need re-binding.
  useEffect(() => {
    const collectRects = (): ItemRect[] => {
      const container = getItemsElRef.current()
      if (!container) return []
      return Array.from(container.querySelectorAll<HTMLElement>('[data-tag-id]')).map((el) => {
        const r = el.getBoundingClientRect()
        return { id: el.getAttribute('data-tag-id') ?? '', left: r.left, right: r.right, top: r.top, bottom: r.bottom }
      })
    }

    /** Recompute offset + gapIndex for the current pointer + scroll. Shared by
     *  pointermove and the auto-scroll frame so the dragged item stays glued to
     *  the pointer and the insertion line tracks even with no pointer motion. */
    const recompute = (): void => {
      const p = pendingRef.current
      const scrollEl = getScrollElRef.current()
      if (!p || !draggingRef.current || !scrollEl) return
      const pointerAlong = along(lastClientRef.current.x, lastClientRef.current.y)
      const scrollDelta = scrollOf(scrollEl) - p.scrollStart
      const offset = pointerAlong - p.startAlong + scrollDelta
      const gapIndex = gapIndexFromRects(collectRects(), pointerAlong, axisRef.current, p.id)
      const next = { id: p.id, offset, gapIndex }
      latestDragRef.current = next
      setDrag(next)
    }
    recomputeRef.current = recompute

    /** Abandon a pending press without arming it into a drag — the touch
     *  moved past the cancel threshold before the long-press timer fired, or
     *  the gesture ended (pointerup) before it fired. Clears the timer so it
     *  can't still arm afterwards. */
    const cancelPending = (): void => {
      const p = pendingRef.current
      if (p?.longPressTimer != null) clearTimeout(p.longPressTimer)
      pendingRef.current = null
      draggingRef.current = false
    }

    let raf: number | null = null
    let vel = 0
    const stopAuto = (): void => {
      if (raf != null) { cancelAnimationFrame(raf); raf = null }
      vel = 0
    }
    const tick = (): void => {
      const el = getScrollElRef.current()
      if (!el || vel === 0 || !draggingRef.current) { raf = null; return }
      if (axisRef.current === 'x') el.scrollLeft += vel
      else el.scrollTop += vel
      recompute()
      raf = requestAnimationFrame(tick)
    }
    const updateAuto = (): void => {
      const el = getScrollElRef.current()
      if (!el) { stopAuto(); return }
      const r = el.getBoundingClientRect()
      const pointer = along(lastClientRef.current.x, lastClientRef.current.y)
      const startEdge = axisRef.current === 'x' ? r.left : r.top
      const endEdge = axisRef.current === 'x' ? r.right : r.bottom
      const cur = scrollOf(el)
      const max = axisRef.current === 'x' ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight
      let v = 0
      if (pointer < startEdge + AUTOSCROLL_EDGE_PX && cur > 0) {
        v = -Math.ceil(clamp01((startEdge + AUTOSCROLL_EDGE_PX - pointer) / AUTOSCROLL_EDGE_PX) * AUTOSCROLL_MAX_STEP)
      } else if (pointer > endEdge - AUTOSCROLL_EDGE_PX && cur < max) {
        v = Math.ceil(clamp01((pointer - (endEdge - AUTOSCROLL_EDGE_PX)) / AUTOSCROLL_EDGE_PX) * AUTOSCROLL_MAX_STEP)
      }
      vel = v
      if (v !== 0 && raf == null) raf = requestAnimationFrame(tick)
      if (v === 0) stopAuto()
    }

    const onMove = (e: PointerEvent): void => {
      const p = pendingRef.current
      if (!p) return
      lastClientRef.current = { x: e.clientX, y: e.clientY }
      if (!draggingRef.current) {
        const movedPx = Math.abs(along(e.clientX, e.clientY) - p.startAlong)
        if (p.pointerType === 'touch') {
          // Touch arms via the long-press timer (started in
          // onItemPointerDown), never via movement. Moving before it fires
          // means the finger is scrolling the list, not reordering — cancel
          // the pending press and leave the event alone (no preventDefault)
          // so native scroll takes over.
          if (movedPx > TOUCH_CANCEL_MOVE_PX) cancelPending()
          return
        }
        if (movedPx < DRAG_THRESHOLD_PX) return
        draggingRef.current = true
        document.body.style.userSelect = 'none'
      }
      e.preventDefault()
      recompute()
      updateAuto()
    }

    const onUp = (): void => {
      const p = pendingRef.current
      if (p?.longPressTimer != null) clearTimeout(p.longPressTimer)
      const wasDragging = draggingRef.current
      const cur = latestDragRef.current
      stopAuto()
      document.body.style.userSelect = ''
      pendingRef.current = null
      draggingRef.current = false
      latestDragRef.current = null
      if (wasDragging && cur && p) {
        suppressClickRef.current = true
        const list = [...idsRef.current]
        const next = computeReorder(list, p.id, cur.gapIndex)
        if (next.some((id, i) => id !== list[i])) onReorderRef.current?.(next)
      }
      setDrag(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      stopAuto()
      document.body.style.userSelect = ''
      if (pendingRef.current?.longPressTimer != null) clearTimeout(pendingRef.current.longPressTimer)
    }
  }, [along, scrollOf])

  const onItemPointerDown = useCallback((id: string, e: ReactPointerEvent<HTMLElement>): void => {
    if (e.button !== 0 || !onReorderRef.current) return
    const scrollEl = getScrollElRef.current()
    suppressClickRef.current = false
    draggingRef.current = false
    lastClientRef.current = { x: e.clientX, y: e.clientY }
    const pointerType = e.pointerType
    pendingRef.current = {
      id,
      startAlong: along(e.clientX, e.clientY),
      scrollStart: scrollEl ? scrollOf(scrollEl) : 0,
      pointerType,
      // Mouse/pen: armed immediately, same as before (6px threshold in
      // onMove does the rest). Touch: arms only once the long-press timer
      // below fires, so a swipe that starts scrolling never gets grabbed.
      armed: pointerType !== 'touch',
      longPressTimer: null,
    }
    if (pointerType === 'touch') {
      pendingRef.current.longPressTimer = setTimeout(() => {
        const p = pendingRef.current
        if (!p || p.id !== id || p.pointerType !== 'touch') return
        p.armed = true
        draggingRef.current = true
        document.body.style.userSelect = 'none'
        // Subtle physical feedback that the press has armed — best-effort,
        // silently absent on devices/browsers without the Vibration API.
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate(10)
        }
        // Recompute now (pointer hasn't necessarily moved yet) so the row
        // immediately picks up the existing `data-dragging` visual — the
        // same "grabbed" feedback mouse/pen get once their threshold trips.
        recomputeRef.current()
      }, TOUCH_LONG_PRESS_MS)
    }
  }, [along, scrollOf])

  const shouldSuppressClick = useCallback((): boolean => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return true }
    return false
  }, [])

  return { drag, isDragging: drag !== null, onItemPointerDown, shouldSuppressClick }
}
