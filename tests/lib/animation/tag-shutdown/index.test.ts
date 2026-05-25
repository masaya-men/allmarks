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
})
