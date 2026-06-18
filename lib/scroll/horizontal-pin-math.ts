/** Total horizontal travel for a pinned horizontal-scroll track. */
export function horizontalScrollDistance(trackWidth: number, viewportWidth: number): number {
  return Math.max(0, trackWidth - viewportWidth)
}

/**
 * Local progress (0..1) of one panel within an evenly-divided horizontal track.
 * globalProgress is the whole pin's 0..1 progress; the track is split into
 * `panelCount` equal segments and `index` selects one (0-based). Values before
 * the segment clamp to 0, after to 1.
 */
export function panelProgress(globalProgress: number, panelCount: number, index: number): number {
  const segment = 1 / panelCount
  const start = index * segment
  const local = (globalProgress - start) / segment
  return Math.max(0, Math.min(1, local))
}
