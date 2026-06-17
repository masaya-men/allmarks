import { describe, it, expect } from 'vitest'
import { parallaxY } from './parallax-math'

describe('parallaxY', () => {
  it('maps progress 0→1 to -distance→+distance, centered at 0', () => {
    expect(parallaxY(0, 100)).toBe(-100)
    expect(parallaxY(0.5, 100)).toBe(0)
    expect(parallaxY(1, 100)).toBe(100)
  })
})
