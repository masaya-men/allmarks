import type { BoardFilter, FilterMode } from './types'

export const BOARD_FILTER_ALL: BoardFilter = { kind: 'all' }
export const BOARD_FILTER_INBOX: BoardFilter = { kind: 'inbox' }
export const BOARD_FILTER_ARCHIVE: BoardFilter = { kind: 'archive' }
export const BOARD_FILTER_DEAD: BoardFilter = { kind: 'dead' }

export function makeTagsFilter(tagIds: readonly string[], mode: FilterMode): BoardFilter {
  return { kind: 'tags', tagIds, mode }
}

export function isTagsFilter(
  f: BoardFilter,
): f is Extract<BoardFilter, { kind: 'tags' }> {
  return f.kind === 'tags'
}

export function getActiveTagIds(f: BoardFilter): readonly string[] {
  return isTagsFilter(f) ? f.tagIds : []
}

export function boardFilterEquals(a: BoardFilter, b: BoardFilter): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind !== 'tags') return true
  // both tags
  const bb = b as Extract<BoardFilter, { kind: 'tags' }>
  if (a.mode !== bb.mode) return false
  if (a.tagIds.length !== bb.tagIds.length) return false
  return a.tagIds.every((id, i) => id === bb.tagIds[i])
}

/** Toggle a tag in/out of an existing tags-filter.
 *  - Non-tags filter → new tags filter with this 1 tag, AND mode.
 *  - tags filter not containing id → append id.
 *  - tags filter containing id → remove id; if 0 left, return ALL filter.
 *  Mode is preserved when toggling within an existing tags filter. */
export function toggleTagInFilter(current: BoardFilter, tagId: string): BoardFilter {
  if (!isTagsFilter(current)) {
    return { kind: 'tags', tagIds: [tagId], mode: 'and' }
  }
  if (current.tagIds.includes(tagId)) {
    const next = current.tagIds.filter((id) => id !== tagId)
    if (next.length === 0) return BOARD_FILTER_ALL
    return { kind: 'tags', tagIds: next, mode: current.mode }
  }
  return { kind: 'tags', tagIds: [...current.tagIds, tagId], mode: current.mode }
}
