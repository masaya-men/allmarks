import { describe, expect, it } from 'vitest'
import { scrollRuleSplit } from './scroll-rule'

describe('scrollRuleSplit', () => {
  it('is empty at 0 and full at 1', () => {
    expect(scrollRuleSplit(0, 300, 100)).toEqual({ track: 0, label: 0 })
    expect(scrollRuleSplit(1, 300, 100)).toEqual({ track: 1, label: 1 })
  })
  it('fills the track first, then the label', () => {
    const mid = scrollRuleSplit(0.5, 300, 100)
    expect(mid.track).toBeCloseTo(200 / 300)
    expect(mid.label).toBe(0)
    const late = scrollRuleSplit(0.9, 300, 100)
    expect(late.track).toBe(1)
    expect(late.label).toBeCloseTo(0.6)
  })
  it('clamps and handles degenerate input', () => {
    expect(scrollRuleSplit(2, 300, 100).label).toBe(1)
    expect(scrollRuleSplit(-1, 300, 100).track).toBe(0)
    expect(scrollRuleSplit(Number.NaN, 300, 100).track).toBe(0)
    expect(scrollRuleSplit(0.4, 0, 0)).toEqual({ track: 0.4, label: 0.4 })
  })
})
