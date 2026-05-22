import { describe, it, expect } from 'vitest'
import { ambientBackingScale, AMBIENT_TARGET_DPR } from './ambient-backing-scale'

describe('ambientBackingScale', () => {
  it('downscales on a high-DPR (4K @ 258%) screen to reach the target', () => {
    const s = ambientBackingScale(2.58, 1.0)
    expect(s).toBeCloseTo(1 / 2.58, 4)
  })

  it('does not change anything on an FHD-class (DPR 1) screen', () => {
    expect(ambientBackingScale(1, 1.0)).toBe(1)
  })

  it('never upscales render: clamps to 1 when device is below target', () => {
    expect(ambientBackingScale(0.8, 1.0)).toBe(1)
  })

  it('goes more aggressive (smaller) for a lower 720p-class target', () => {
    expect(ambientBackingScale(2.58, 0.75)).toBeCloseTo(0.75 / 2.58, 4)
  })

  it('defaults to AMBIENT_TARGET_DPR when no target is passed', () => {
    expect(ambientBackingScale(2)).toBe(ambientBackingScale(2, AMBIENT_TARGET_DPR))
  })

  it('is defensive against bogus values', () => {
    expect(ambientBackingScale(0, 1)).toBe(1)
    expect(ambientBackingScale(2, 0)).toBe(1)
    expect(ambientBackingScale(Number.NaN, 1)).toBe(1)
  })
})
