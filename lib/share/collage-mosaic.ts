import type { CollageElement, CollageFitRect, CollagePositions } from './collage-layout'

/** Squarified treemap (Bruls, Huizing & van Wijk 2000) — self-built, no
 *  dependency (the reference implementation is d3-hierarchy's
 *  treemapSquarify, but pulling in all of d3 for one ~80-line algorithm
 *  isn't worth it). Every card gets EQUAL weight (area), so the algorithm's
 *  only job is choosing near-square cell shapes that tile `rect` with zero
 *  leftover space — unlike fitSelectionToScreen, cell shape does not follow
 *  each card's own aspect ratio, so the card face renders it via
 *  object-fit:cover (already the app's standard image treatment, see
 *  ImageCard.module.css) and crops to fit. */

type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
type Item = { readonly id: string; readonly area: number }

/** Worst (largest) aspect ratio produced by laying `row` out along a strip
 *  of length `w`. Lower is more square / better. Standard squarify formula. */
function worstRatio(row: readonly Item[], w: number): number {
  const sum = row.reduce((s, it) => s + it.area, 0)
  let max = -Infinity
  let min = Infinity
  for (const it of row) {
    if (it.area > max) max = it.area
    if (it.area < min) min = it.area
  }
  if (sum <= 0 || w <= 0 || min <= 0) return Infinity
  const sq = sum * sum
  const wsq = w * w
  return Math.max((wsq * max) / sq, sq / (wsq * min))
}

/** Lays `row` out as a single strip against the shorter side of `rect`,
 *  writes each item's rect into `out`, and returns the rect that remains
 *  after removing that strip. */
function layoutRow(row: readonly Item[], rect: Rect, out: Record<string, Rect>): Rect {
  const sum = row.reduce((s, it) => s + it.area, 0)
  const vertical = rect.width >= rect.height // strip runs along the shorter side
  if (vertical) {
    // Row forms a vertical strip on the left, width = sum / height.
    const stripW = rect.height > 0 ? sum / rect.height : 0
    let y = rect.y
    for (const it of row) {
      const h = stripW > 0 ? it.area / stripW : 0
      out[it.id] = { x: rect.x, y, width: stripW, height: h }
      y += h
    }
    return { x: rect.x + stripW, y: rect.y, width: Math.max(0, rect.width - stripW), height: rect.height }
  }
  // Row forms a horizontal strip on top, height = sum / width.
  const stripH = rect.width > 0 ? sum / rect.width : 0
  let x = rect.x
  for (const it of row) {
    const w = stripH > 0 ? it.area / stripH : 0
    out[it.id] = { x, y: rect.y, width: w, height: stripH }
    x += w
  }
  return { x: rect.x, y: rect.y + stripH, width: rect.width, height: Math.max(0, rect.height - stripH) }
}

function squarify(items: readonly Item[], rect: Rect, out: Record<string, Rect>): void {
  let remaining = items
  let currentRect = rect
  let row: Item[] = []
  while (remaining.length > 0) {
    const w = Math.min(currentRect.width, currentRect.height)
    const next = remaining[0]
    const candidate = [...row, next]
    if (row.length === 0 || worstRatio(candidate, w) <= worstRatio(row, w)) {
      row = candidate
      remaining = remaining.slice(1)
    } else {
      currentRect = layoutRow(row, currentRect, out)
      row = []
    }
  }
  if (row.length > 0) layoutRow(row, currentRect, out)
}

export type MosaicOptions = {
  /** Visual gutter between cells (px). Real CSS `gap` semantics: applied
   *  ONLY between adjacent cells — a cell whose side lands on the rect's
   *  own boundary stays flush against it, so the container is still filled
   *  edge-to-edge with zero margin regardless of gap. Default 0. */
  readonly gap?: number
}

const BOUNDARY_EPSILON = 0.01

function isOnBoundary(value: number, boundary: number): boolean {
  return Math.abs(value - boundary) <= BOUNDARY_EPSILON
}

/** Fills `rect` completely (no leftover margin) by partitioning it into one
 *  equal-area cell per card via a squarified treemap. Cell shape does not
 *  preserve each card's own aspect ratio — see file header. Empty selection
 *  or a zero-area rect returns {}. */
export function fitSelectionMosaic(
  cards: readonly CollageElement[],
  rect: CollageFitRect,
  opts?: MosaicOptions,
): CollagePositions {
  if (cards.length === 0 || rect.width <= 0 || rect.height <= 0) return {}
  const gap = Math.max(0, opts?.gap ?? 0)
  const half = gap / 2

  // Equal weight per card: every cell gets the same share of the rect's area.
  const area = (rect.width * rect.height) / cards.length
  const items: Item[] = cards.map((c) => ({ id: c.id, area }))

  const raw: Record<string, Rect> = {}
  squarify(items, { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, raw)

  const out: Record<string, { x: number; y: number; w: number; h: number }> = {}
  for (const c of cards) {
    const r = raw[c.id]
    if (!r) continue
    // Only inset sides that border ANOTHER cell — a side sitting on the
    // rect's own boundary gets no inset, so gap never creates an outer
    // margin (matches CSS `gap`, not `padding`).
    const insetLeft = isOnBoundary(r.x, rect.x) ? 0 : half
    const insetTop = isOnBoundary(r.y, rect.y) ? 0 : half
    const insetRight = isOnBoundary(r.x + r.width, rect.x + rect.width) ? 0 : half
    const insetBottom = isOnBoundary(r.y + r.height, rect.y + rect.height) ? 0 : half
    out[c.id] = {
      x: r.x + insetLeft,
      y: r.y + insetTop,
      w: Math.max(0, r.width - insetLeft - insetRight),
      h: Math.max(0, r.height - insetTop - insetBottom),
    }
  }
  return out
}
