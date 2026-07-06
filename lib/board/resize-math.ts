/**
 * Pure math for corner-drag card resize, shared by the board ResizeHandle and
 * the SHARE collage. Extracted so the two resize "feels" are unit-testable
 * (the gesture layer uses setPointerCapture, which synthetic Playwright
 * pointers can't drive).
 */

export type ResizeCorner = 'tl' | 'tr' | 'bl' | 'br'

/**
 * Which pointer-movement direction ENLARGES the card from a given corner.
 * BR grows on +x/+y (down-right), TL on -x/-y (up-left), etc.
 */
export function cornerGrowSigns(corner: ResizeCorner): { readonly signX: number; readonly signY: number } {
  return {
    signX: corner === 'tr' || corner === 'br' ? 1 : -1,
    signY: corner === 'bl' || corner === 'br' ? 1 : -1,
  }
}

/**
 * How a resize drag maps pointer movement to a new card width.
 *
 * - `'dominant'` (board default, unchanged): the larger-magnitude axis wins,
 *   keeping its sign; the vertical axis is scaled by aspect so a vertical drag
 *   also resizes. Fast per-axis, but DISCONTINUOUS: when the two axes disagree
 *   in sign, the dominant one can flip to the opposite-sign amplified term and
 *   the width leaps. On a free-floating card this reads as a sudden multi-fold
 *   grow/shrink on a slightly off-diagonal drag.
 *
 * - `'projection'` (SHARE collage): the pointer movement is projected onto the
 *   corner's grow diagonal, expressed in width px, so width changes CONTINUOUSLY
 *   in every drag direction (no axis-dominance flip → no jump) and an off-axis /
 *   vertical drift can't over-amplify. On a pure-diagonal drag (the natural
 *   corner gesture) it is identical to `'dominant'`, so the everyday feel and the
 *   MIN↔MAX reach are preserved.
 */
export type ResizeModel = 'dominant' | 'projection'

/**
 * Compute the next card width from a resize drag, clamped to [min, max].
 * `aspect` = cardWidth / cardHeight captured at drag start; `totalDx/totalDy`
 * are the pointer offset from drag start in screen px; `sensitivity` scales
 * pointer distance to width change.
 */
export function resizeWidthFromPointer(input: {
  readonly corner: ResizeCorner
  readonly startWidth: number
  readonly aspect: number
  readonly totalDx: number
  readonly totalDy: number
  readonly sensitivity: number
  readonly min: number
  readonly max: number
  readonly model?: ResizeModel
}): number {
  const { corner, startWidth, aspect, totalDx, totalDy, sensitivity, min, max } = input
  const model = input.model ?? 'dominant'
  const { signX, signY } = cornerGrowSigns(corner)

  let dWidth: number
  if (model === 'projection') {
    // a = aspect (guarded > 0). Projection of grow-positive movement onto the
    // corner's diagonal, in width px: dWidth = (growX + growY/a) / (1 + 1/a²).
    // This equals w·(growX·w + growY·h)/(w²+h²) with h = w/a — the along-diagonal
    // component, linear in the pointer delta (hence continuous, no jump).
    const a = aspect > 0 ? aspect : 1
    const growX = totalDx * signX
    const growY = totalDy * signY
    dWidth = (growX + growY / a) / (1 + 1 / (a * a))
  } else {
    // Board default — preserved byte-for-byte from the original ResizeHandle.
    const dx = totalDx * signX
    const dyW = aspect > 0 ? totalDy * signY * aspect : 0
    dWidth = Math.abs(dx) >= Math.abs(dyW) ? dx : dyW
  }

  return Math.max(min, Math.min(max, startWidth + dWidth * sensitivity))
}
