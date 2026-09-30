import { describe, expect, it } from 'vitest'
import { layoutMarks, markFractions, scrollRuleSplit } from './scroll-rule'

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

describe('markFractions', () => {
  it('covers each mark once the fill front passes it', () => {
    const lefts = [100, 400]
    const widths = [100, 100]
    expect(markFractions(0, 1000, lefts, widths)).toEqual([0, 0])
    expect(markFractions(0.15, 1000, lefts, widths)).toEqual([0.5, 0])
    expect(markFractions(0.45, 1000, lefts, widths)).toEqual([1, 0.5])
    expect(markFractions(1, 1000, lefts, widths)).toEqual([1, 1])
  })
})

describe('layoutMarks', () => {
  it('keeps natural positions when there is room', () => {
    const r = layoutMarks([0.1, 0.5], [80, 80], 1000, 900, 10)
    expect(r.lefts).toEqual([100, 500])
    expect(r.fits).toBe(true)
  })
  it('pushes neighbours apart minimally and reports overflow', () => {
    const r = layoutMarks([0.1, 0.11], [80, 80], 1000, 900, 10)
    expect(r.lefts).toEqual([100, 190])
    expect(r.fits).toBe(true)
    expect(layoutMarks([0.1, 0.11], [80, 80], 1000, 250, 10).fits).toBe(false)
  })
  it('pulls the last marks back inside the limit when they overflow', () => {
    const r = layoutMarks([0.1, 0.9], [80, 80], 1000, 500, 10)
    expect(r.fits).toBe(false)
    expect(r.lefts).toEqual([100, 420])
    const r2 = layoutMarks([0.5, 0.9], [80, 80], 1000, 500, 10)
    expect(r2.lefts).toEqual([330, 420])
  })
})
