import { describe, it, expect } from 'vitest'
import { easeOutCubic, rollingCountValue } from '@/lib/board/use-rolling-count'

describe('easeOutCubic', () => {
  it('starts at 0 and ends at 1', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
  })

  it('clamps input outside [0,1]', () => {
    expect(easeOutCubic(-0.5)).toBe(0)
    expect(easeOutCubic(1.5)).toBe(1)
  })

  it('is front-loaded (past the midpoint before t=0.5)', () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5)
  })
})

describe('rollingCountValue', () => {
  it('returns the target immediately when durationMs <= 0', () => {
    expect(rollingCountValue(3, 7, 0, 0)).toBe(7)
    expect(rollingCountValue(3, 7, 100, -10)).toBe(7)
  })

  it('returns the start value at elapsed=0', () => {
    expect(rollingCountValue(3, 7, 0, 350)).toBe(3)
  })

  it('snaps to the target once elapsed reaches the duration', () => {
    expect(rollingCountValue(3, 7, 350, 350)).toBe(7)
    expect(rollingCountValue(3, 7, 500, 350)).toBe(7)
  })

  it('is monotonically non-decreasing toward an increasing target', () => {
    const to = 12
    const from = 2
    const samples = [0, 50, 100, 150, 200, 250, 300, 350].map((e) =>
      rollingCountValue(from, to, e, 350),
    )
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1])
    }
    expect(samples[0]).toBe(from)
    expect(samples[samples.length - 1]).toBe(to)
  })

  it('handles a decreasing target the same way (symmetry)', () => {
    expect(rollingCountValue(10, 4, 0, 350)).toBe(10)
    expect(rollingCountValue(10, 4, 350, 350)).toBe(4)
    expect(rollingCountValue(10, 4, 175, 350)).toBeLessThan(10)
    expect(rollingCountValue(10, 4, 175, 350)).toBeGreaterThan(4)
  })

  it('is a no-op roll when from equals to', () => {
    expect(rollingCountValue(5, 5, 175, 350)).toBe(5)
  })
})
