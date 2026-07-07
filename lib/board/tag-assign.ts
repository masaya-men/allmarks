/**
 * TAG MODE drop assignment (spec 2026-07-07-tag-mode-drag-drop-design).
 *
 * When the user drags a card (or a selection) onto a tag row and drops, EVERY
 * targeted card should gain that tag, additively — the card keeps whatever tags
 * it already had (union). This module holds the two pure helpers so the drop
 * behaviour is unit-testable independently of the drag gesture / React tree.
 */

/** Minimal view of a card the assignment needs: its id and current tag ids. */
export type TagAssignCard = {
  readonly bookmarkId: string
  readonly tags: readonly string[]
}

/** One card's resulting full tag list after an additive drop. */
export type TagAssignment = {
  readonly bookmarkId: string
  readonly nextTags: readonly string[]
}

/**
 * Decide which cards a drop tags: if the grabbed card is part of the current
 * selection, the drop applies to the WHOLE selection (batch tag). If the
 * grabbed card is NOT selected, the drop applies to just that one card (a quick
 * single-card tag that leaves the selection untouched).
 */
export function resolveDropTargets(
  draggedId: string,
  selectedIds: ReadonlySet<string>,
): readonly string[] {
  if (selectedIds.has(draggedId)) return [...selectedIds]
  return [draggedId]
}

/**
 * Compute the additive tag writes for a drop of `tagId` onto `cardIds`.
 *
 * For each target that exists and does NOT already carry `tagId`, returns the
 * new full tag list = existing tags + tagId (union, order preserved, tagId
 * appended). Targets that already have the tag — or that aren't in `cards` —
 * are omitted so no redundant IDB write / re-render fires. Duplicate ids in
 * `cardIds` collapse to a single write.
 */
export function computeTagAssignments(
  cards: readonly TagAssignCard[],
  cardIds: readonly string[],
  tagId: string,
): readonly TagAssignment[] {
  const byId = new Map(cards.map((c) => [c.bookmarkId, c]))
  const out: TagAssignment[] = []
  const done = new Set<string>()
  for (const id of cardIds) {
    if (done.has(id)) continue
    done.add(id)
    const card = byId.get(id)
    if (!card) continue
    if (card.tags.includes(tagId)) continue
    out.push({ bookmarkId: id, nextTags: [...card.tags, tagId] })
  }
  return out
}
