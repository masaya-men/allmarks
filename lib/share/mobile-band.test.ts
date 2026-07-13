import { describe, expect, it } from 'vitest'
import { SHARE_OG_ASPECT, mobileCollageBandRect, mobileCaptureScale, SHARE_PORTRAIT_ASPECT, mobileCollagePortraitBandRect, collageBandRect } from './mobile-band'

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

  it('inscribes a 1.91:1 band in a landscape frame, cutting the sides', () => {
    const r = mobileCollageBandRect(844, 390)
    // frameIsWider: 844*630 > 390*1200 → yes, landscape
    // width = 390 * 1200 / 630 ≈ 742.857
    expect(r.x).toBeCloseTo(50.5714285714, 6)
    expect(r.y).toBe(0)
    expect(r.width).toBeCloseTo(742.8571428571, 6)
    expect(r.height).toBe(390)
  })

  it('returns an empty rect for degenerate frames', () => {
    expect(mobileCollageBandRect(0, 844)).toEqual({ x: 0, y: 0, width: 0, height: 0 })
    expect(mobileCollageBandRect(390, 0)).toEqual({ x: 0, y: 0, width: 0, height: 0 })
    expect(mobileCollageBandRect(-10, -10)).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })

  it('band always maintains the 1.91:1 aspect ratio of the OG image', () => {
    const portrait = mobileCollageBandRect(390, 844)
    expect(portrait.width / portrait.height).toBeCloseTo(SHARE_OG_ASPECT.WIDTH / SHARE_OG_ASPECT.HEIGHT, 6)

    const landscape = mobileCollageBandRect(844, 390)
    expect(landscape.width / landscape.height).toBeCloseTo(SHARE_OG_ASPECT.WIDTH / SHARE_OG_ASPECT.HEIGHT, 6)
  })
})

describe('mobileCaptureScale', () => {
  it('makes the band exactly 1200 raster px wide on a phone', () => {
    expect(mobileCaptureScale(390)).toBeCloseTo(3.0769230769, 6)
    expect(390 * mobileCaptureScale(390)).toBeCloseTo(SHARE_OG_ASPECT.WIDTH, 6)
  })

  it('scales landscape band to 1200 raster px', () => {
    const bandWidth = 742.8571428571
    expect(mobileCaptureScale(bandWidth)).toBeCloseTo(1.6153846154, 6)
    expect(bandWidth * mobileCaptureScale(bandWidth)).toBeCloseTo(SHARE_OG_ASPECT.WIDTH, 6)
  })

  it('never downscales a band already at or wider than the OG image', () => {
    expect(mobileCaptureScale(1489)).toBe(1)
    expect(mobileCaptureScale(1200)).toBe(1)
  })

  it('caps at 4 so a freak narrow band cannot explode the canvas', () => {
    expect(mobileCaptureScale(300)).toBe(4)
    expect(mobileCaptureScale(100)).toBe(4)
  })

  it('falls back to 1 for a degenerate band width', () => {
    expect(mobileCaptureScale(0)).toBe(1)
    expect(mobileCaptureScale(-5)).toBe(1)
  })
})

describe('mobileCollagePortraitBandRect (9:16 portrait)', () => {
  it('inscribes a centred 9:16 band in a tall phone frame', () => {
    // 360x900: portrait band keeps full width, height = 360 * 1920/1080 = 640, y-centred
    expect(mobileCollagePortraitBandRect(360, 900)).toEqual({ x: 0, y: 130, width: 360, height: 640 })
  })

  it('keeps the 9:16 ratio and caps sides on a wide frame', () => {
    // 900x360 wide: keeps full height, width = 360 * 1080/1920 = 202.5, x-centred
    const b = mobileCollagePortraitBandRect(900, 360)
    expect(b).toEqual({ x: 348.75, y: 0, width: 202.5, height: 360 })
    expect(b.width / b.height).toBeCloseTo(1080 / 1920) // 0.5625 = 9:16
  })

  it('returns empty on a degenerate frame', () => {
    expect(mobileCollagePortraitBandRect(0, 900)).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })
})

describe('collageBandRect (generalised)', () => {
  it('matches mobileCollageBandRect for the 1.91:1 aspect', () => {
    expect(collageBandRect(390, 844, 1200, 630)).toEqual(mobileCollageBandRect(390, 844))
  })
})
