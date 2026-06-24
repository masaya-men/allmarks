import { describe, it, expect } from 'vitest'
import { getShutdownAnimationClass } from '@/lib/animation/tag-shutdown'

describe('getShutdownAnimationClass', () => {
  it('wave テーマで CSS class が返る', () => {
    const c = getShutdownAnimationClass('wave')
    expect(c).toMatch(/shutdown/)
  })

  it('未対応テーマ key では undefined フォールバック (= shutdown アニメ無し)', () => {
    const c = getShutdownAnimationClass('forest')
    expect(c).toBeUndefined()
  })

  it('paper-fade テーマで紙 dissolve の CSS class が返る', () => {
    const c = getShutdownAnimationClass('paper-fade')
    expect(typeof c).toBe('string')
    expect(c).toBeTruthy()
  })

  it('paper-fade と wave は別 class (= テーマごとに別 module)', () => {
    expect(getShutdownAnimationClass('paper-fade')).not.toBe(
      getShutdownAnimationClass('wave'),
    )
  })
})
