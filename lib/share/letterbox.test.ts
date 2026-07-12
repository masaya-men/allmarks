import { describe, expect, it } from 'vitest'
import { containFitRect } from './letterbox'

describe('containFitRect', () => {
  it('fits a portrait 4:5 image into a 1.91:1 card, centred with side bars', () => {
    // 1080x1350 into 1200x630 -> scale = min(1200/1080, 630/1350) = 0.4667; w=504, h=630, x=348, y=0
    const r = containFitRect(1080, 1350, 1200, 630)
    expect(r.w).toBeCloseTo(504)
    expect(r.h).toBeCloseTo(630)
    expect(r.x).toBeCloseTo(348)
    expect(r.y).toBeCloseTo(0)
  })

  it('fits a wide image into a square, centred with top/bottom bars', () => {
    // 1000x500 into 600x600 -> scale = min(0.6, 1.2) = 0.6; w=600, h=300, x=0, y=150
    const r = containFitRect(1000, 500, 600, 600)
    expect(r).toEqual({ x: 0, y: 150, w: 600, h: 300 })
  })

  it('returns a zero rect on degenerate input', () => {
    expect(containFitRect(0, 100, 100, 100)).toEqual({ x: 0, y: 0, w: 0, h: 0 })
  })
})
