import { describe, it, expect } from 'vitest'
import { clamp01, eio, E, lerp, wp, isPress } from './motion-math'

describe('motion-math', () => {
  it('clamp01', () => { expect(clamp01(-1)).toBe(0); expect(clamp01(0.3)).toBe(0.3); expect(clamp01(2)).toBe(1) })
  it('eio is 0 / .5 / 1 at the ends and middle', () => { expect(eio(0)).toBe(0); expect(eio(0.5)).toBe(0.5); expect(eio(1)).toBe(1) })
  it('E maps [a,b] to eased 0..1 and clamps outside', () => {
    expect(E(0.1, 0.2, 0.4)).toBe(0); expect(E(0.5, 0.2, 0.4)).toBe(1); expect(E(0.3, 0.2, 0.4)).toBeCloseTo(0.5)
  })
  it('lerp', () => { expect(lerp(10, 20, 0.25)).toBe(12.5) })
  it('wp holds the first point before, the last after, and eases between', () => {
    const pts = [[0.2, 0, 0], [0.6, 100, 50]] as const
    expect(wp(0.1, pts)).toEqual({ x: 0, y: 0 })
    expect(wp(0.9, pts)).toEqual({ x: 100, y: 50 })
    expect(wp(0.4, pts)).toEqual({ x: 50, y: 25 })
  })
  it('isPress is true from tc-.012 up to tc+.03', () => {
    expect(isPress(0.627, 0.64)).toBe(false); expect(isPress(0.629, 0.64)).toBe(true)
    expect(isPress(0.669, 0.64)).toBe(true); expect(isPress(0.671, 0.64)).toBe(false)
  })
})
