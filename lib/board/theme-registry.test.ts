import { describe, it, expect } from 'vitest'
import { THEME_REGISTRY, listThemeIds, getThemeMeta, DEFAULT_THEME_ID } from './theme-registry'

describe('THEME_REGISTRY contract', () => {
  it('every theme fills the contract fields', () => {
    for (const id of listThemeIds()) {
      const m = getThemeMeta(id)
      expect(m.id).toBe(id)
      expect(typeof m.backgroundClassName).toBe('string')
      expect(m.labelKey.startsWith('board.theme.')).toBe(true)
      expect(['free', 'paid']).toContain(m.tier)
      expect(['light', 'dark']).toContain(m.colorScheme)
    }
  })
  it('registers paper-atelier as a free, light theme', () => {
    const m = getThemeMeta('paper-atelier')
    expect(m.colorScheme).toBe('light')
    expect(m.tier).toBe('free')
    expect(m.backgroundClassName).toBe('paperAtelier')
    expect(m.labelKey).toBe('board.theme.paperAtelier')
  })
  it('keeps the default theme dark + free', () => {
    expect(DEFAULT_THEME_ID).toBe('dotted-notebook')
    expect(getThemeMeta('dotted-notebook').colorScheme).toBe('dark')
    expect(getThemeMeta('dotted-notebook').tier).toBe('free')
  })
})
