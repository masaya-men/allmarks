// lib/board/tag-scroll-edge.ts
//
// Pure decision for the FilterPill tag-list fade affordance (no-plain-scrollbar
// house rule: a top/bottom fade mask stands in for the scrollbar). Extracted so
// the overflow logic is unit-testable without a real layout engine.

export type TagScrollEdge = 'none' | 'top' | 'middle' | 'bottom'

export type TagScrollMetrics = {
  /** Full content height of the scroller (stable from the first frame). */
  readonly scrollHeight: number
  /** Current scroll offset. */
  readonly scrollTop: number
  /** Live viewport height of the scroller. Only reliable once the dropdown's
   *  open animation has settled, so it is used ONLY for the top/bottom split,
   *  never for the overflow decision. */
  readonly clientHeight: number
  /** The scroller's CSS max-height — a constant cap that never animates. This,
   *  not clientHeight, is what decides whether the list overflows. */
  readonly maxHeight: number
}

/**
 * Decide whether (and where) to fade the tag list.
 *
 * The overflow test compares scrollHeight against the scroller's fixed
 * max-height, NOT its live clientHeight. The dropdown opens with a
 * `grid-template-rows: 0fr → 1fr` animation, during which clientHeight ramps up
 * from ~0. Deciding overflow off that animating clientHeight makes a short,
 * fully-fitting list (e.g. a single tag) briefly read as "taller than the box"
 * and flash a fade mask over the very rows the user just opened the menu to see.
 * scrollHeight is correct from the first frame and max-height never animates, so
 * comparing them is stable across the whole open — no flash.
 */
export function computeTagScrollEdge(m: TagScrollMetrics): TagScrollEdge {
  const cap = Number.isFinite(m.maxHeight) ? m.maxHeight : m.clientHeight
  if (m.scrollHeight <= cap + 1) return 'none'
  const atTop = m.scrollTop <= 1
  const atBottom = m.scrollTop + m.clientHeight >= m.scrollHeight - 1
  return atTop ? 'top' : atBottom ? 'bottom' : 'middle'
}
