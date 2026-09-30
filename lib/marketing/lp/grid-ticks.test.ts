import { describe, expect, it } from 'vitest'
import { TICK_GAP, tickStep, tickWrap } from './grid-ticks'

describe('tickStep', () => {
  it('moves 1:1 with scroll', () => expect(tickStep(4)).toBe(4))
  it('clamps to +-38.4', () => {
    expect(tickStep(1000)).toBeCloseTo(38.4)
    expect(tickStep(-1000)).toBeCloseTo(-38.4)
  })
  it('is 0 at rest', () => expect(tickStep(0)).toBe(0))
})

describe('tickWrap', () => {
  it('wraps into 0..gap', () => {
    expect(tickWrap(0)).toBe(0)
    expect(tickWrap(TICK_GAP)).toBe(0)
    expect(tickWrap(100)).toBeCloseTo(4)
    expect(tickWrap(-4)).toBeCloseTo(92)
    expect(tickWrap(-TICK_GAP * 3 - 1)).toBeCloseTo(95)
  })
})
