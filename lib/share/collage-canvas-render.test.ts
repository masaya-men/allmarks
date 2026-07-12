import { describe, it, expect } from 'vitest'
import { coverRect, mapBandToOutput } from './collage-canvas-render'

describe('coverRect', () => {
  it('should crop vertically for square image into landscape dst', () => {
    // Square image 100x100 into landscape dst 1200x630
    // scale = max(1200/100, 630/100) = max(12, 6.3) = 12
    // sw = 1200/12 = 100
    // sh = 630/12 = 52.5
    // sx = (100 - 100)/2 = 0
    // sy = (100 - 52.5)/2 = 23.75
    const result = coverRect(100, 100, 1200, 630)
    expect(result.sx).toBe(0)
    expect(result.sy).toBe(23.75)
    expect(result.sw).toBe(100)
    expect(result.sh).toBe(52.5)
  })

  it('should crop horizontally for wide image into landscape dst', () => {
    // Wide image 200x100 into landscape dst 1200x630
    // scale = max(1200/200, 630/100) = max(6, 6.3) = 6.3
    // sw = 1200/6.3 ≈ 190.476...
    // sh = 630/6.3 = 100
    // sx = (200 - 190.476...)/2 ≈ 4.762...
    // sy = (100 - 100)/2 = 0
    const result = coverRect(200, 100, 1200, 630)
    expect(result.sx).toBeCloseTo(4.762, 2)
    expect(result.sy).toBe(0)
    expect(result.sw).toBeCloseTo(190.476, 2)
    expect(result.sh).toBe(100)
  })

  it('should handle edge case with zero dimensions by returning safe zero rect', () => {
    // Edge case: zero image dimension
    const result1 = coverRect(0, 100, 1200, 630)
    expect(result1.sx).toBe(0)
    expect(result1.sy).toBe(0)
    expect(result1.sw).toBe(0)
    expect(result1.sh).toBe(0)

    // Edge case: zero dst dimension
    const result2 = coverRect(100, 100, 0, 630)
    expect(result2.sx).toBe(0)
    expect(result2.sy).toBe(0)
    expect(result2.sw).toBe(0)
    expect(result2.sh).toBe(0)
  })
})

describe('mapBandToOutput', () => {
  it('should map rect in band-space to output (1200x630) with offset and scale', () => {
    // band with non-zero offset
    // band = {x: 40, y: 120, width: 1200, height: 628}
    // pos = {x: 100, y: 200, w: 200, h: 100}
    // outW = 1200, outH = 630
    // sx = 1200/1200 = 1
    // sy = 630/628 ≈ 1.00318...
    // x = (100 - 40) * 1 = 60
    // y = (200 - 120) * 1.00318... ≈ 80.254...
    // w = 200 * 1 = 200
    // h = 100 * 1.00318... ≈ 100.318...
    const result = mapBandToOutput(
      { x: 100, y: 200, w: 200, h: 100 },
      { x: 40, y: 120, width: 1200, height: 628 },
      1200,
      630
    )
    expect(result.x).toBe(60)
    expect(result.y).toBeCloseTo(80.254, 2)
    expect(result.w).toBe(200)
    expect(result.h).toBeCloseTo(100.318, 2)
  })

  it('should handle pos at band origin', () => {
    // pos at band origin (x, y) = band origin
    // band = {x: 40, y: 120, width: 1200, height: 628}
    // pos = {x: 40, y: 120, w: 100, h: 100}
    // outW = 1200, outH = 630
    // sx = 1200/1200 = 1
    // sy = 630/628 ≈ 1.00318...
    // x = (40 - 40) * 1 = 0
    // y = (120 - 120) * 1.00318... = 0
    // w = 100 * 1 = 100
    // h = 100 * 1.00318... ≈ 100.318...
    const result = mapBandToOutput(
      { x: 40, y: 120, w: 100, h: 100 },
      { x: 40, y: 120, width: 1200, height: 628 },
      1200,
      630
    )
    expect(result.x).toBe(0)
    expect(result.y).toBeCloseTo(0, 2)
    expect(result.w).toBe(100)
    expect(result.h).toBeCloseTo(100.318, 2)
  })

  it('should apply ~1.91:1 scaling correctly for 1200x630 output', () => {
    // band exactly 1200x628 (≈1.91:1)
    // pos small rect at (600, 314, 100, 100)
    // outW = 1200, outH = 630
    // sx = 1200/1200 = 1
    // sy = 630/628 ≈ 1.00318...
    // y = (314 - 0) * 1.00318... ≈ 315.000...
    // h = 100 * 1.00318... ≈ 100.318...
    const result = mapBandToOutput(
      { x: 600, y: 314, w: 100, h: 100 },
      { x: 0, y: 0, width: 1200, height: 628 },
      1200,
      630
    )
    expect(result.x).toBe(600)
    expect(result.y).toBeCloseTo(315, 1)
    expect(result.w).toBe(100)
    expect(result.h).toBeCloseTo(100.318, 2)
  })
})
