/** Pure gesture-resolution logic for the mobile lightbox (session 180).
 *
 *  Kept free of React and the DOM so the thresholds are unit-testable — the
 *  actual touch feel is real-device-only (Playwright's synthetic touch and JS
 *  scroll ignore touch-action; see memory reference_native_scroll_touch_action_
 *  playwright), but the maths that decides "did this drag mean next / prev /
 *  close / sheet" can and must be tested here. */

export type SwipeAxis = 'none' | 'horizontal' | 'vertical'
export type SwipeIntent = 'none' | 'next' | 'prev' | 'close' | 'sheet'

export const SWIPE = {
  /** A drag stays axis-undecided until it travels this far, so a still finger
   *  or a tiny jitter never locks into a direction. */
  AXIS_LOCK_PX: 8,
  /** Downward drag past this fraction of viewport height closes. */
  CLOSE_RATIO: 0.25,
  /** Horizontal drag past this fraction of viewport width navigates. */
  NAV_RATIO: 0.35,
  /** Upward drag past this fraction of viewport height opens the info sheet. */
  SHEET_RATIO: 0.18,
  /** A flick faster than this (px/ms, absolute) triggers even under distance. */
  FLICK_VELOCITY: 0.5,
} as const

/** Decide the gesture axis from the first significant move. Returns 'none'
 *  while the drag is still under the lock threshold (undecided). */
export function resolveAxis(dx: number, dy: number, lockPx: number = SWIPE.AXIS_LOCK_PX): SwipeAxis {
  if (Math.abs(dx) < lockPx && Math.abs(dy) < lockPx) return 'none'
  return Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical'
}

export type ResolveIntentArgs = {
  readonly axis: SwipeAxis
  readonly dx: number
  readonly dy: number
  /** signed velocity, px/ms */
  readonly vx: number
  readonly vy: number
  readonly viewportW: number
  readonly viewportH: number
  /** Navigation boundaries — when at an end, the matching swipe is a no-op. */
  readonly atEnd?: { readonly prev: boolean; readonly next: boolean }
}

/** Given a completed drag, decide what it means. Distance OR flick velocity
 *  can satisfy each threshold. Left = next, right = prev, down = close,
 *  up = sheet. Navigation is blocked at the corresponding end. */
export function resolveIntent(a: ResolveIntentArgs): SwipeIntent {
  if (a.axis === 'horizontal') {
    const passed = Math.abs(a.dx) > a.viewportW * SWIPE.NAV_RATIO || Math.abs(a.vx) > SWIPE.FLICK_VELOCITY
    if (!passed) return 'none'
    if (a.dx < 0) return a.atEnd?.next ? 'none' : 'next'
    return a.atEnd?.prev ? 'none' : 'prev'
  }
  if (a.axis === 'vertical') {
    if (a.dy > 0) {
      const passed = a.dy > a.viewportH * SWIPE.CLOSE_RATIO || a.vy > SWIPE.FLICK_VELOCITY
      return passed ? 'close' : 'none'
    }
    const passed = -a.dy > a.viewportH * SWIPE.SHEET_RATIO || -a.vy > SWIPE.FLICK_VELOCITY
    return passed ? 'sheet' : 'none'
  }
  return 'none'
}
