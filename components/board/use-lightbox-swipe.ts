import { useCallback, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { resolveAxis, resolveIntent, type SwipeAxis, type SwipeIntent } from './lightbox-swipe'

export type UseLightboxSwipeOpts = {
  /** True side = the main content can still scroll that way, so a vertical
   *  drag there belongs to the inner scroll, not close/sheet. Omit for
   *  non-scrolling content (images/video), where all vertical gestures act. */
  readonly contentScrollable?: () => { top: boolean; bottom: boolean }
  /** Navigation boundaries so an end-swipe is a no-op. */
  readonly atEnd?: () => { prev: boolean; next: boolean }
  /** Fired once on pointer release with the resolved gesture. `speed` is the
   *  release velocity (px/ms, absolute) along the locked axis — drives how many
   *  cards a hard horizontal flick advances (inertia). */
  readonly onIntent: (intent: SwipeIntent, info: { speed: number }) => void
  /** Fired on every move (and once with 'none'/0/0 on release) so the caller
   *  can translate the stage/main to follow the finger. */
  readonly onDrag?: (axis: SwipeAxis, dx: number, dy: number) => void
}

type Sample = { x: number; y: number; t: number }

/** Wires pointer events for the mobile lightbox's 4-direction swipe. The touch
 *  feel is real-device-only; the decision maths live in ./lightbox-swipe
 *  (unit-tested). Mouse pointers are ignored (desktop uses the PC lightbox). */
export function useLightboxSwipe(opts: UseLightboxSwipeOpts): {
  readonly bind: {
    onPointerDown: (e: ReactPointerEvent) => void
    onPointerMove: (e: ReactPointerEvent) => void
    onPointerUp: (e: ReactPointerEvent) => void
    onPointerCancel: (e: ReactPointerEvent) => void
  }
  readonly axisRef: RefObject<SwipeAxis>
} {
  const startRef = useRef<Sample | null>(null)
  const lastRef = useRef<Sample | null>(null)
  const axisRef = useRef<SwipeAxis>('none')

  const onPointerDown = useCallback((e: ReactPointerEvent): void => {
    if (e.pointerType === 'mouse') return
    const s: Sample = { x: e.clientX, y: e.clientY, t: performance.now() }
    startRef.current = s
    lastRef.current = s
    axisRef.current = 'none'
  }, [])

  const onPointerMove = useCallback((e: ReactPointerEvent): void => {
    const start = startRef.current
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    lastRef.current = { x: e.clientX, y: e.clientY, t: performance.now() }
    if (axisRef.current === 'none') {
      const axis = resolveAxis(dx, dy)
      if (axis === 'none') return
      // Vertical drag with inner scroll room → let the content scroll instead.
      if (axis === 'vertical' && opts.contentScrollable) {
        const s = opts.contentScrollable()
        if ((dy > 0 && !s.top) || (dy < 0 && !s.bottom)) return
      }
      axisRef.current = axis
    }
    opts.onDrag?.(axisRef.current, dx, dy)
  }, [opts])

  const finish = useCallback((): void => {
    const start = startRef.current
    const last = lastRef.current
    startRef.current = null
    if (!start || !last || axisRef.current === 'none') {
      axisRef.current = 'none'
      opts.onDrag?.('none', 0, 0)
      return
    }
    const dx = last.x - start.x
    const dy = last.y - start.y
    const dt = Math.max(1, last.t - start.t)
    const axis = axisRef.current
    const intent = resolveIntent({
      axis,
      dx,
      dy,
      vx: dx / dt,
      vy: dy / dt,
      viewportW: window.innerWidth,
      viewportH: window.innerHeight,
      atEnd: opts.atEnd?.(),
    })
    const speed = Math.abs((axis === 'horizontal' ? dx : dy) / dt)
    axisRef.current = 'none'
    opts.onIntent(intent, { speed })
  }, [opts])

  return {
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (): void => finish(),
      onPointerCancel: (): void => finish(),
    },
    axisRef,
  }
}
