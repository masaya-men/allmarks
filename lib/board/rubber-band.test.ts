import { describe, it, expect } from 'vitest'
import {
  rubberBand,
  computeGrabOffset,
  MAX_GRAB_PX,
  GRAB_LAYER_WEIGHTS,
} from './rubber-band'

describe('rubberBand', () => {
  it('returns 0 at delta 0', () => {
    expect(rubberBand(0, 90)).toBe(0)
  })

  it('caps at the limit in magnitude (never exceeds)', () => {
    // tanh saturates to exactly 1.0 in float for large inputs, so the offset
    // is capped at ±limit — the desired hard stop.
    expect(Math.abs(rubberBand(10_000, 90))).toBeLessThanOrEqual(90)
    expect(Math.abs(rubberBand(-10_000, 90))).toBeLessThanOrEqual(90)
    // A moderate pull stays strictly inside the cap.
    expect(Math.abs(rubberBand(90, 90))).toBeLessThan(90)
  })

  it('is monotonically increasing', () => {
    expect(rubberBand(20, 90)).toBeGreaterThan(rubberBand(10, 90))
    expect(rubberBand(200, 90)).toBeGreaterThan(rubberBand(100, 90))
  })

  it('preserves sign (odd function)', () => {
    expect(rubberBand(-30, 90)).toBeCloseTo(-rubberBand(30, 90), 10)
  })

  it('passes small deltas through nearly 1:1', () => {
    // at delta << limit, tanh(x) ≈ x so output ≈ delta
    expect(rubberBand(5, 90)).toBeCloseTo(5, 1)
  })

  it('returns 0 for a non-positive limit', () => {
    expect(rubberBand(50, 0)).toBe(0)
    expect(rubberBand(50, -10)).toBe(0)
  })
})

describe('computeGrabOffset', () => {
  it('is 0/0 when current equals origin', () => {
    expect(computeGrabOffset(100, 200, 100, 200, MAX_GRAB_PX)).toEqual({ x: 0, y: 0 })
  })

  it('rubber-bands each axis independently', () => {
    const out = computeGrabOffset(0, 0, 5, -5, MAX_GRAB_PX)
    expect(out.x).toBeCloseTo(rubberBand(5, MAX_GRAB_PX), 10)
    expect(out.y).toBeCloseTo(rubberBand(-5, MAX_GRAB_PX), 10)
  })
})

describe('GRAB_LAYER_WEIGHTS', () => {
  it('makes the mid layers swim more than the calm front, deep backdrop least', () => {
    // Intentional "feel the parallax" ordering: mid (decor/pattern) > front
    // (cards) > deep backdrop (parchment). All positive.
    expect(GRAB_LAYER_WEIGHTS.decor).toBeGreaterThan(GRAB_LAYER_WEIGHTS.pattern)
    expect(GRAB_LAYER_WEIGHTS.pattern).toBeGreaterThan(GRAB_LAYER_WEIGHTS.cards)
    expect(GRAB_LAYER_WEIGHTS.cards).toBeGreaterThan(GRAB_LAYER_WEIGHTS.parchment)
    expect(GRAB_LAYER_WEIGHTS.parchment).toBeGreaterThan(0)
  })
})
