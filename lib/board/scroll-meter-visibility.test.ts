import { describe, it, expect } from 'vitest'
import { shouldShowScrollMeter } from './scroll-meter-visibility'

describe('shouldShowScrollMeter', () => {
  it('hides while onboarding', () => {
    expect(shouldShowScrollMeter(true, null)).toBe(false)
    expect(shouldShowScrollMeter(true, 'select')).toBe(false)
  })
  it('hides in arrange stage (collage is not scrollable)', () => {
    expect(shouldShowScrollMeter(false, 'arrange')).toBe(false)
  })
  it('shows in select stage (grid still scrolls) and normal board', () => {
    expect(shouldShowScrollMeter(false, 'select')).toBe(true)
    expect(shouldShowScrollMeter(false, null)).toBe(true)
  })
})
