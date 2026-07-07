import { computeFocusScrollY } from './scroll-to-card'

/**
 * TAG-independent helper for the Lightbox "return to the last-viewed card"
 * behaviour (#7).
 *
 * When the user chevron-navigates inside the Lightbox, the board's source card
 * (what the close FLIP shrinks back into) follows the nav. If the newly-viewed
 * card is already fully within the current viewport we return `null` — the board
 * must stay STILL (it sits behind a frosted-glass backdrop that re-computes its
 * blur every time the content under it moves; a needless scroll = the documented
 * "shake / low-FPS" cost at high DPR). Only when the card is off-screen do we
 * return a new `viewport.y` that centres it, so the close FLIP has a live,
 * on-screen card to land on. The caller applies it as a single instant jump
 * (never a tween) so the blur re-computes once, not per-frame.
 */
export function computeNavReturnScrollY(input: {
  /** Card's layout world-space top (BEFORE the board's top padding). */
  readonly cardY: number
  readonly cardH: number
  /** Board top padding added to world Y to get canvas Y (BOARD_TOP_PAD_PX). */
  readonly topPad: number
  readonly viewportY: number
  readonly viewportH: number
  /** Total scrollable content height (for clamping). */
  readonly contentH: number
}): number | null {
  const { cardY, cardH, topPad, viewportY, viewportH, contentH } = input
  const top = cardY + topPad
  const bottom = top + cardH
  // Fully visible → keep the board still (no reposition behind the backdrop).
  if (top >= viewportY && bottom <= viewportY + viewportH) return null
  const target = computeFocusScrollY({ cardY: top, cardH, viewportH, contentH })
  // If the clamp lands us where we already are, treat it as "no move" so the
  // caller can skip a redundant setState (e.g. a tall card already pinned at
  // the top of a short board).
  if (target === viewportY) return null
  return target
}
