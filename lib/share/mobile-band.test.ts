import { describe, expect, it } from 'vitest'
import { SHARE_OG_ASPECT, mobileCollageBandRect, mobileCaptureScale } from './mobile-band'

describe('mobileCollageBandRect', () => {
  it('centres a 1.91:1 band inside a 390x844 phone frame', () => {
    const r = mobileCollageBandRect(390, 844)
    expect(r).toEqual({ x: 0, y: 319.625, width: 390, height: 204.75 })
  })

  it('matches what computeCoverRect will crop (band height = width * 630/1200)', () => {
    const r = mobileCollageBandRect(360, 640)
    expect(r.height).toBeCloseTo(189, 6)
    expect(r.y).toBeCloseTo(225.5, 6)
    expect(r.width).toBe(360)
    expect(r.x).toBe(0)
  })

  it('clamps to the frame when the band would be taller than it (landscape)', () => {
    const r = mobileCollageBandRect(844, 390)
    // 844 * 0.525 = 443.1 > 390 → clamp to the frame, no vertical offset
    expect(r.height).toBe(390)
    expect(r.y).toBe(0)
    expect(r.width).toBe(844)
  })

  it('returns an empty rect for degenerate frames', () => {
    expect(mobileCollageBandRect(0, 844)).toEqual({ x: 0, y: 0, width: 0, height: 0 })
    expect(mobileCollageBandRect(390, 0)).toEqual({ x: 0, y: 0, width: 0, height: 0 })
    expect(mobileCollageBandRect(-10, -10)).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })
})

describe('mobileCaptureScale', () => {
  it('makes the band exactly 1200 raster px wide on a phone', () => {
    expect(mobileCaptureScale(390)).toBeCloseTo(3.0769230769, 6)
    expect(390 * mobileCaptureScale(390)).toBeCloseTo(SHARE_OG_ASPECT.WIDTH, 6)
  })

  it('never downscales a frame already wider than the OG image', () => {
    expect(mobileCaptureScale(1489)).toBe(1)
    expect(mobileCaptureScale(1200)).toBe(1)
  })

  it('caps at 4 so a freak narrow frame cannot explode the canvas', () => {
    expect(mobileCaptureScale(300)).toBe(4)
    expect(mobileCaptureScale(100)).toBe(4)
  })

  it('falls back to 1 for a degenerate width', () => {
    expect(mobileCaptureScale(0)).toBe(1)
    expect(mobileCaptureScale(-5)).toBe(1)
  })
})
