/**
 * Pure gesture logic for the manage (/triage) screen's card-drag interaction.
 *
 * The card in the central glass can be grabbed and dragged. On release we
 * classify the gesture from the pointer displacement and whether the pointer
 * is over a tag chip:
 *   - over a chip            → tag it (and the page applies + advances)
 *   - barely moved (a tap)   → open the bookmark URL in a new tab
 *   - big horizontal drag    → the existing yes / no swipe
 *   - anything else          → snap back, no-op
 *
 * Kept side-effect-free so it can be unit-tested in isolation (same pattern as
 * lib/board/drag-reorder-geometry.ts).
 */

export type TriageReleaseOutcome =
  | { kind: 'open' }
  | { kind: 'tag'; tagId: string }
  | { kind: 'yes' }
  | { kind: 'no' }
  | { kind: 'cancel' }

/** A tag chip's viewport rectangle, captured for pointer hit-testing. */
export interface ChipRect {
  readonly tagId: string
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

/**
 * Return the id of the chip whose rect contains the pointer, or null when the
 * pointer is over none. Edges are inclusive; the first match wins if rects
 * overlap (chips never overlap in practice).
 */
export function hitTestChip(
  pointerX: number,
  pointerY: number,
  chips: readonly ChipRect[],
): string | null {
  for (const c of chips) {
    if (pointerX >= c.left && pointerX <= c.right && pointerY >= c.top && pointerY <= c.bottom) {
      return c.tagId
    }
  }
  return null
}

export interface ReleaseInput {
  /** Pointer displacement from press to release. */
  readonly dx: number
  readonly dy: number
  /** Chip under the pointer at release time (from hitTestChip), or null. */
  readonly targetTagId: string | null
  /** Total movement below this counts as a tap (= open). */
  readonly tapThresholdPx?: number
  /** Horizontal distance at/above this counts as a yes/no swipe. */
  readonly swipeThresholdPx?: number
}

/**
 * Classify a pointer release into the triage gesture it represents. Priority:
 * an explicit drop on a chip first (the user aimed at a tag), then a tap, then
 * a horizontal swipe, otherwise cancel.
 */
export function classifyRelease({
  dx,
  dy,
  targetTagId,
  tapThresholdPx = 6,
  swipeThresholdPx = 60,
}: ReleaseInput): TriageReleaseOutcome {
  // 1) Released over a tag chip → tag it. Explicit aim wins over distance.
  if (targetTagId) return { kind: 'tag', tagId: targetTagId }

  // 2) Barely moved → tap → open the link.
  const dist = Math.hypot(dx, dy)
  if (dist < tapThresholdPx) return { kind: 'open' }

  // 3) Horizontal-dominant drag past the swipe threshold → yes / no.
  if (Math.abs(dx) >= swipeThresholdPx && Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? { kind: 'yes' } : { kind: 'no' }
  }

  // 4) Otherwise: a stray drag (e.g. up into a gap). Snap back, do nothing.
  return { kind: 'cancel' }
}
