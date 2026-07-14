import { describe, expect, it } from 'vitest'
import { getEntryAnimation } from './index'
import { getShutdownAnimationClass } from '../tag-shutdown/index'

describe('flat theme motion: fade', () => {
  it('fade entry returns a gentle opacity+translateY keyframe set', () => {
    const a = getEntryAnimation('fade')
    expect(a).toBeDefined()
    expect(a!.keyframes[0].opacity).toBe('0')
    expect(a!.keyframes[a!.keyframes.length - 1].opacity).toBe('1')
  })
  it('fade shutdown returns a class', () => {
    expect(getShutdownAnimationClass('fade')).toBeTruthy()
  })
})
