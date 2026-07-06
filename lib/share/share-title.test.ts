import { describe, it, expect } from 'vitest'
import { defaultShareTitleConfig, resolveTitleText, setTitleSize, moveTitle, TITLE_MIN_PX, TITLE_MAX_PX } from './share-title'

describe('share-title', () => {
  it('default is centered and uses default text (null override)', () => {
    const c = defaultShareTitleConfig(true, 1000, 600)
    expect(c).toMatchObject({ enabled: true, text: null, x: 500, y: 300 })
    expect(resolveTitleText(c, 'my tag')).toBe('my tag')
  })
  it('disabled resolves to empty string', () => {
    const c = { ...defaultShareTitleConfig(true, 1000, 600), enabled: false }
    expect(resolveTitleText(c, 'my tag')).toBe('')
  })
  it('override text wins over default', () => {
    const c = { ...defaultShareTitleConfig(true, 1000, 600), text: 'SUMMER' }
    expect(resolveTitleText(c, 'my tag')).toBe('SUMMER')
  })
  it('setTitleSize clamps', () => {
    const c = defaultShareTitleConfig(true, 1000, 600)
    expect(setTitleSize(c, 5).size).toBe(TITLE_MIN_PX)
    expect(setTitleSize(c, 99999).size).toBe(TITLE_MAX_PX)
  })
  it('moveTitle sets x/y', () => {
    const c = moveTitle(defaultShareTitleConfig(true, 1000, 600), 12, 34)
    expect(c).toMatchObject({ x: 12, y: 34 })
  })
})
