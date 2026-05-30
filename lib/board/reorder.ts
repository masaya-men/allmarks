/**
 * Move one item to a new slot in an ordered id list (drag-to-reorder).
 *
 * `gapIndex` is the insertion line position in the *current* list, counted in
 * gaps `[0 .. ids.length]` — `0` = before the first row, `ids.length` = after
 * the last. Because the dragged id is removed before re-insertion, a drop
 * target below the original slot shifts down by one; this helper does that
 * adjustment so callers can pass the raw gap index straight from hit-testing.
 *
 * Returns a new array (never mutates). A no-op move returns an equivalent
 * order, so callers can compare to decide whether to persist.
 *
 * @param ids - current order of ids
 * @param draggedId - the id being moved
 * @param gapIndex - insertion gap in the current list, `[0 .. ids.length]`
 */
export function computeReorder(
  ids: readonly string[],
  draggedId: string,
  gapIndex: number,
): string[] {
  const fromIndex = ids.indexOf(draggedId)
  if (fromIndex < 0) return [...ids]

  let insertPos = gapIndex
  if (insertPos > fromIndex) insertPos -= 1
  insertPos = Math.max(0, Math.min(ids.length - 1, insertPos))
  if (insertPos === fromIndex) return [...ids]

  const next = ids.filter((id) => id !== draggedId)
  next.splice(insertPos, 0, draggedId)
  return next
}
