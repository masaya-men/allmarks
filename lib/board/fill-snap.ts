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
 * `snapToFillAtCurrentColumns` pulls a released value to the fill value for
 * the CURRENT column count only (never jumps to a neighbouring N) when it is
 * released within a small threshold. The faders render the current-N
 * candidate as a mark so the alignment point is visible.
 *
 * All functions here are pure so they unit-test without a DOM.
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
