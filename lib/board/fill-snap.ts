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
