/** Upper bound (px) for the grab offset before the pull is fully resisted.
 *  Applied to the base offset; each layer scales it by GRAB_LAYER_WEIGHTS. */
export const MAX_GRAB_PX = 90

/** Per-layer depth multipliers for the grab offset. Tuned as a "feel the
 *  parallax" play: the cards (front) stay calm while the MID layer swims the
 *  most, so grabbing makes the world behind the cards slide noticeably. `decor`
 *  is the paper-atelier scatter layer; `pattern` is the viewport-anchored
 *  dots/grid backdrop (pattern themes) driven via background-position;
 *  `parchment` is the deep paper backdrop (moves least). */
export const GRAB_LAYER_WEIGHTS = {
  cards: 0.4,
  decor: 0.85,
  pattern: 0.8,
  parchment: 0.28,
} as const

/** Spring-back tween config used when the grab is released. */
export const GRAB_SPRING = {
  duration: 0.7,
  ease: 'elastic.out(1, 0.4)',
} as const

/** Resistance curve: near-linear for small |delta|, asymptoting to ±limit as
 *  |delta| grows (rubber-band). Odd function, so sign is preserved. Returns 0
 *  for a non-positive limit. */
export function rubberBand(delta: number, limit: number): number {
  if (limit <= 0) return 0
  return limit * Math.tanh(delta / limit)
}

/** Rubber-banded offset from a grab origin to the current pointer, per axis. */
export function computeGrabOffset(
  originX: number,
  originY: number,
  currentX: number,
  currentY: number,
  limit: number,
): { x: number; y: number } {
  return {
    x: rubberBand(currentX - originX, limit),
    y: rubberBand(currentY - originY, limit),
  }
}
