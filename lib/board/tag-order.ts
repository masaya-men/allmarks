import type { TagRecord } from '@/lib/storage/indexeddb'

/**
 * How the tag list is ordered everywhere it appears (filter dropdown, triage
 * strip, background typography). Persisted so board + triage agree across
 * navigations.
 *
 * - `auto-asc` / `auto-desc`: sorted by name (locale-aware, so Japanese kana
 *   fall in あ→ん order). New tags drop into the right place automatically.
 * - `manual`: the user's hand-dragged order (the tag record's `order` field).
 */
export type TagOrderMode = 'auto-asc' | 'auto-desc' | 'manual'

/** Default for first-time + existing users: alphabetical ascending. Existing
 *  tags keep their `order` field, but it only takes effect once the user opts
 *  into manual order by dragging one. */
export const DEFAULT_TAG_ORDER_MODE: TagOrderMode = 'auto-asc'

/** Locale-aware name comparison. `numeric` so "tag2" < "tag10"; `sensitivity:
 *  base` since tag names already display lowercase. Locale left to the runtime
 *  default — good enough for kana ordering; kanji fall back to code point. */
function compareNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

/**
 * Return a new array of tags in the order dictated by `mode`. Never mutates.
 *
 * @param tags - the tags (any order; `manual` reads each record's `order`)
 * @param mode - the active ordering mode
 */
export function sortTagsByMode(tags: readonly TagRecord[], mode: TagOrderMode): TagRecord[] {
  if (mode === 'manual') return [...tags].sort((a, b) => a.order - b.order)
  const dir = mode === 'auto-desc' ? -1 : 1
  return [...tags].sort((a, b) => dir * compareNames(a.name, b.name))
}

/** The mode the asc/desc toggle moves to next. manual → asc, asc → desc,
 *  desc → asc. Pressing the toggle always lands in an `auto-*` mode (so the
 *  list re-sorts and new tags slot in correctly). */
export function nextTagOrderMode(mode: TagOrderMode): TagOrderMode {
  return mode === 'auto-asc' ? 'auto-desc' : 'auto-asc'
}
