/**
 * Pure geometry for drag-to-reorder hit-testing, shared by the vertical
 * (filter dropdown) and horizontal (triage chip strip) reorder gestures.
 *
 * The companion to {@link computeReorder}: this turns a pointer position +
 * the live item rectangles into the *insertion gap index* that computeReorder
 * consumes. Kept pure (no DOM) so the tricky "exclude the dragged item" rule
 * is unit-testable.
 */

export type ReorderAxis = 'x' | 'y'

/** One reorder candidate's bounding box (viewport coords) + its id, in list order. */
export type ItemRect = {
  readonly id: string
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
}

/**
 * Compute the insertion gap `[0 .. items.length]` for a drag.
 *
 * CRITICAL: the dragged item is SKIPPED. While dragging, the grabbed item is
 * translated to follow the pointer, so its rect sits under the pointer the
 * whole time. If it were included, dragging toward higher indices (right / down)
 * would always hit the dragged item's own early-in-order rect first and return
 * its original index → a no-op move. Skipping it makes both directions
 * symmetric (this is the root-cause fix for "can't reorder rightward").
 *
 * Returns the index of the first NON-dragged item whose midpoint along `axis`
 * lies past the pointer; `items.length` when the pointer is past them all.
 *
 * @param items     - reorder candidates in list order, with live rects
 * @param pointer   - pointer position along `axis` (clientX for 'x', clientY for 'y')
 * @param axis      - 'x' for a horizontal strip, 'y' for a vertical list
 * @param draggedId - id of the grabbed item (excluded from the hit-test)
 */
export function gapIndexFromRects(
  items: readonly ItemRect[],
  pointer: number,
  axis: ReorderAxis,
  draggedId: string,
): number {
  for (let i = 0; i < items.length; i++) {
    if (items[i].id === draggedId) continue
    const r = items[i]
    const mid = axis === 'x' ? (r.left + r.right) / 2 : (r.top + r.bottom) / 2
    if (pointer < mid) return i
  }
  return items.length
}
