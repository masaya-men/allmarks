import { describe, it, expect } from 'vitest'
import { cardCornerRadiusPx } from './card-radius'

describe('cardCornerRadiusPx', () => {
  it('square (0px) when corners are off — regardless of width/minimalRadius', () => {
    expect(cardCornerRadiusPx({ width: 300, roundedCorners: false, minimalRadius: false })).toBe('0px')
    expect(cardCornerRadiusPx({ width: 40, roundedCorners: false, minimalRadius: true })).toBe('0px')
  })

  it('minimalRadius (paper) stays 3px when rounded', () => {
    expect(cardCornerRadiusPx({ width: 300, roundedCorners: true, minimalRadius: true })).toBe('3px')
  })

  it('size-aware min(20, w*0.12) otherwise', () => {
    expect(cardCornerRadiusPx({ width: 300, roundedCorners: true, minimalRadius: false })).toBe('20.0px') // capped
    expect(cardCornerRadiusPx({ width: 100, roundedCorners: true, minimalRadius: false })).toBe('12.0px') // 100*0.12
    expect(cardCornerRadiusPx({ width: 50, roundedCorners: true, minimalRadius: false })).toBe('6.0px')  // small stays natural
  })

  it('flat/dark theme uses the size-aware formula (not a hard 3px)', () => {
    expect(cardCornerRadiusPx({ width: 240, roundedCorners: true, minimalRadius: false })).toBe('20.0px') // min(20, 240*0.12=28.8)
    expect(cardCornerRadiusPx({ width: 100, roundedCorners: true, minimalRadius: false })).toBe('12.0px') // 100*0.12
  })

  it('minimalRadius (paper) stays 3px; corners off = 0px', () => {
    expect(cardCornerRadiusPx({ width: 240, roundedCorners: true, minimalRadius: true })).toBe('3px')
    expect(cardCornerRadiusPx({ width: 240, roundedCorners: false, minimalRadius: true })).toBe('0px')
  })
})
