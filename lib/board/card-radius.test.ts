import { describe, it, expect } from 'vitest'
import { cardCornerRadiusPx } from './card-radius'

describe('cardCornerRadiusPx', () => {
  it('square (0px) when corners are off — regardless of width/flat', () => {
    expect(cardCornerRadiusPx({ width: 300, roundedCorners: false, flat: false })).toBe('0px')
    expect(cardCornerRadiusPx({ width: 40, roundedCorners: false, flat: true })).toBe('0px')
  })

  it('flat 3px on light/paper themes when rounded', () => {
    expect(cardCornerRadiusPx({ width: 300, roundedCorners: true, flat: true })).toBe('3px')
  })

  it('size-aware min(20, w*0.12) otherwise', () => {
    expect(cardCornerRadiusPx({ width: 300, roundedCorners: true, flat: false })).toBe('20.0px') // capped
    expect(cardCornerRadiusPx({ width: 100, roundedCorners: true, flat: false })).toBe('12.0px') // 100*0.12
    expect(cardCornerRadiusPx({ width: 50, roundedCorners: true, flat: false })).toBe('6.0px')  // small stays natural
  })
})
