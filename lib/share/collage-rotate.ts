/**
 * Pure math for free card rotation in the SHARE collage (arrange stage only —
 * the board grid never tilts). Kept pure/testable since the rotate gesture uses
 * setPointerCapture, which synthetic Playwright pointers can't drive.
 */

/** Angle (deg) of a pointer around a center, in SCREEN coords (y grows down). */
export function pointerAngleDeg(centerX: number, centerY: number, pointerX: number, pointerY: number): number {
  return (Math.atan2(pointerY - centerY, pointerX - centerX) * 180) / Math.PI
}

/** Wrap an angle into (-180, 180]. */
export function normalizeAngle(deg: number): number {
  const r = ((deg % 360) + 360) % 360 // [0, 360)
  return r > 180 ? r - 360 : r
}

/**
 * New rotation (deg) for a card given a rotate-handle drag: carry the card's
 * existing rotation and add the pointer's angular swing (currentAngle −
 * startAngle, both from `pointerAngleDeg` around the card center). A light
 * magnetic snap pulls the result onto the nearest `snapStep`° when within
 * `snapWithinDeg`° — so clean angles (0/15/30/45…) are easy to hit while free
 * rotation stays fully free between the steps.
 */
export function rotateFromPointer(input: {
  readonly startRotation: number
  readonly startAngle: number
  readonly currentAngle: number
  readonly snapStep?: number
  readonly snapWithinDeg?: number
}): number {
  const step = input.snapStep ?? 15
  const within = input.snapWithinDeg ?? 4
  const raw = normalizeAngle(input.startRotation + (input.currentAngle - input.startAngle))
  const nearest = Math.round(raw / step) * step
  return Math.abs(normalizeAngle(raw - nearest)) <= within ? normalizeAngle(nearest) : raw
}
