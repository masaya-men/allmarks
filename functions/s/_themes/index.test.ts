// functions/s/_themes/index.test.ts
import { describe, it, expect } from 'vitest'
import { allThemes, pickTheme } from './index'

describe('theme registry', () => {
  it('contains at least one theme', () => {
    expect(allThemes.length).toBeGreaterThan(0)
  })

  it('every theme has the required non-empty fields', () => {
    for (const theme of allThemes) {
      expect(theme.name).toMatch(/.+/)
      expect(theme.bodyHTML).toMatch(/.+/)
      expect(theme.inlineCSS).toMatch(/.+/)
      expect(theme.inlineScript).toMatch(/.+/)
    }
  })

  it('includes the wave theme', () => {
    expect(allThemes.some((t) => t.name === 'wave')).toBe(true)
  })
})

describe('pickTheme', () => {
  it('returns the first theme when random returns 0', () => {
    const picked = pickTheme(() => 0)
    expect(picked).toBe(allThemes[0])
  })

  it('returns the last theme when random returns just under 1', () => {
    const picked = pickTheme(() => 0.9999)
    expect(picked).toBe(allThemes[allThemes.length - 1])
  })

  it('cycles through different themes for different random values (when more than 1 theme exists)', () => {
    if (allThemes.length < 2) {
      // Skip — single theme case (= current state). The test asserts the structure
      // would support variety. Add a second theme to actually exercise this.
      return
    }
    const a = pickTheme(() => 0)
    const b = pickTheme(() => 0.999)
    expect(a).not.toBe(b)
  })
})
