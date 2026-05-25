import type { BoardFilter } from './types'
import { BOARD_FILTER_ALL } from './board-filter-helpers'

/** Convert any v15-or-older persisted activeFilter value (= string union or
 *  unknown) into the v16 BoardFilter object form. Safe on already-migrated
 *  object values (returns input unchanged when shape matches). */
export function migrateLegacyBoardFilter(legacy: unknown): BoardFilter {
  // Already migrated?
  if (legacy && typeof legacy === 'object' && 'kind' in legacy) {
    return legacy as BoardFilter
  }
  if (typeof legacy !== 'string') return BOARD_FILTER_ALL
  switch (legacy) {
    case 'all': return { kind: 'all' }
    case 'inbox': return { kind: 'inbox' }
    case 'archive': return { kind: 'archive' }
    case 'dead': return { kind: 'dead' }
  }
  if (legacy.startsWith('mood:')) {
    const id = legacy.slice(5)
    if (id.length > 0) return { kind: 'tags', tagIds: [id], mode: 'and' }
  }
  return BOARD_FILTER_ALL
}
