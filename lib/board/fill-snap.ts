/**
 * Fill-snap math for the TUNE W/G faders.
 *
 * The board packs default-width cards left-to-right inside `containerWidth`
 * (= viewport − 2·SIDE_PADDING) with `gap` between them (see skyline-layout).
 * Because packing is left-aligned, any width that doesn't divide the container
 * evenly leaves a leftover band on the RIGHT edge only — the left margin stays
 * at SIDE_PADDING while the right margin grows by the leftover. The board then
 * looks lopsided (cards hug the left, empty strip on the right).
 *
 * A "fill" configuration is one where, for some integer column count N,
 *     N·width + (N−1)·gap === containerWidth
 * so the row reaches both edges and the left/right margins are equal.
 *
 * `fillCandidates` enumerates the dragged-axis values that produce a fill (for
 * every valid N, holding the other axis fixed); `snapToFill` pulls a value to
 * the nearest such candidate when it is released within a small threshold. The
 * faders render the candidates as marks so the alignment points are visible.
 *
 * Both functions are pure so they unit-test without a DOM.
 */

export type FillAxis = 'width' | 'gap'

/** Default release-snap radius, in value-space px. A value released within
 *  this distance of a fill candidate clicks onto it; anything farther is left
 *  exactly where the user dropped it, so deliberate non-fill values remain
 *  reachable. Candidate spacing near the defaults is ~50–80 px, so this stays
 *  well inside one candidate's basin. */
export const DEFAULT_FILL_SNAP_THRESHOLD_PX = 10

export type FillSnapInput = {
  /** The value (of the dragged axis) to consider snapping. */
  readonly value: number
  /** The fixed other-axis value: gap when axis='width', width when axis='gap'. */
  readonly other: number
  /** Board packing width (= effective layout width, viewport − 2·side padding). */
  readonly containerWidth: number
  readonly axis: FillAxis
  readonly min: number
  readonly max: number
  readonly thresholdPx?: number
}

/**
 * Values of the dragged axis at which a row of default-width cards fills the
 * container edge-to-edge, for each integer column count N, holding the other
 * axis fixed. Only physically valid candidates inside [min, max] are returned,
 * sorted ascending.
 *
 * axis='width': widthₙ = (containerWidth − (N−1)·gap) / N,  N = 1, 2, 3, …
 * axis='gap':   gapₙ   = (containerWidth − N·width) / (N−1), N = 2, 3, 4, …
 *
 * Both widthₙ and gapₙ decrease monotonically in N, so the scan stops as soon
 * as a candidate drops below `min` (every larger N is smaller still).
 */
export function fillCandidates(
  other: number,
  containerWidth: number,
  axis: FillAxis,
  min: number,
  max: number,
): number[] {
  const out: number[] = []
  if (!(containerWidth > 0)) return out
  // 200 is an unreachable safety cap; the monotonic `break` ends the scan far
  // sooner in every real board (min width 120 / min gap 0 at any viewport).
  const MAX_N = 200
  if (axis === 'width') {
    for (let n = 1; n <= MAX_N; n++) {
      const w = (containerWidth - (n - 1) * other) / n
      if (w < min) break
      if (w <= max) out.push(w)
    }
  } else {
    for (let n = 2; n <= MAX_N; n++) {
      const g = (containerWidth - n * other) / (n - 1)
      if (g < min) break
      if (g <= max) out.push(g)
    }
  }
  // The scan emits candidates in N order (= value-descending); return them
  // value-ascending so callers can treat the list as a sorted scale.
  out.sort((a, b) => a - b)
  return out
}

/**
 * Returns the fill candidate nearest to `value` when it lies within the snap
 * threshold; otherwise returns `value` unchanged. Used on fader release so a
 * near-aligned drop clicks into an even-margin configuration.
 */
export function snapToFill(input: FillSnapInput): number {
  const { value, other, containerWidth, axis, min, max } = input
  const threshold = input.thresholdPx ?? DEFAULT_FILL_SNAP_THRESHOLD_PX
  const candidates = fillCandidates(other, containerWidth, axis, min, max)
  let best = -1
  let bestDist = Infinity
  for (const c of candidates) {
    const d = Math.abs(c - value)
    if (d < bestDist) {
      bestDist = d
      best = c
    }
  }
  if (best < 0 || bestDist > threshold) return value
  return best
}

/**
 * How many uniform-width cards (+ gaps between them) currently fit in the
 * container. N columns need N·width + (N−1)·gap ≤ containerWidth, i.e.
 * N ≤ (containerWidth + gap) / (width + gap). Always ≥ 1.
 */
export function currentColumnCount(width: number, gap: number, containerWidth: number): number {
  if (!(containerWidth > 0) || !(width > 0)) return 1
  return Math.max(1, Math.floor((containerWidth + gap) / (width + gap)))
}

/**
 * The dragged-axis value that fills the container edge-to-edge at EXACTLY
 * `columns` columns (so the left and right margins are equal), holding the
 * other axis fixed. Returns null when the value falls outside [min,max] or the
 * column count is invalid for the axis (gap needs ≥ 2 columns).
 */
export function fillValueAtColumns(
  columns: number,
  other: number,
  containerWidth: number,
  axis: FillAxis,
  min: number,
  max: number,
): number | null {
  if (!(containerWidth > 0) || columns < 1) return null
  let v: number
  if (axis === 'width') {
    v = (containerWidth - (columns - 1) * other) / columns
  } else {
    if (columns < 2) return null
    v = (containerWidth - columns * other) / (columns - 1)
  }
  if (v < min || v > max) return null
  return v
}

/**
 * Snap on release to the even-margin fill value FOR THE CURRENT COLUMN COUNT
 * only — never jumps to a neighbouring column count's fill (the s173 bug where
 * releasing at 5 columns snapped down to a 4-column fill). Keeps the board's
 * left-packed layout; the snap just makes the leftmost/rightmost gaps equal at
 * the count the user already has.
 */
export function snapToFillAtCurrentColumns(input: FillSnapInput): number {
  const { value, other, containerWidth, axis, min, max } = input
  const threshold = input.thresholdPx ?? DEFAULT_FILL_SNAP_THRESHOLD_PX
  const width = axis === 'width' ? value : other
  const gap = axis === 'width' ? other : value
  const n = currentColumnCount(width, gap, containerWidth)
  const target = fillValueAtColumns(n, other, containerWidth, axis, min, max)
  if (target === null) return value
  return Math.abs(target - value) <= threshold ? target : value
}
