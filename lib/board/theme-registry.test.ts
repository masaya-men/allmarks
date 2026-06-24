import { describe, it, expect } from 'vitest'
import { listThemeIds, getThemeMeta, DEFAULT_THEME_ID } from './theme-registry'

describe('THEME_REGISTRY contract', () => {
  it('every theme fills the contract fields', () => {
    for (const id of listThemeIds()) {
      const m = getThemeMeta(id)
      expect(m.id).toBe(id)
      expect(typeof m.backgroundClassName).toBe('string')
      expect(m.labelKey.startsWith('board.theme.')).toBe(true)
      expect(['free', 'paid']).toContain(m.tier)
      expect(['light', 'dark']).toContain(m.colorScheme)
      // Plan 2 contract fields:
      expect(['waveform', 'ruler']).toContain(m.scrollMeterVariant)
      expect(typeof m.motion.entry).toBe('string')
      expect(typeof m.motion.text).toBe('string')
      expect(typeof m.motion.shutdown).toBe('string')
    }
  })
  it('registers paper-atelier as a free, light theme', () => {
    const m = getThemeMeta('paper-atelier')
    expect(m.colorScheme).toBe('light')
    expect(m.tier).toBe('free')
    expect(m.backgroundClassName).toBe('paperAtelier')
    expect(m.labelKey).toBe('board.theme.paperAtelier')
  })
  it('gives paper-atelier the ruler meter + paper motion set + decorations', () => {
    const m = getThemeMeta('paper-atelier')
    expect(m.scrollMeterVariant).toBe('ruler')
    expect(m.motion.entry).toBe('paper-drift')
    expect(m.motion.text).toBe('ink-underline')
    expect(m.motion.shutdown).toBe('paper-fade')
    expect(m.decorations).toBe(true)
  })
  it('keeps the two dark themes on the waveform meter + wave/glitch motion', () => {
    for (const id of ['dotted-notebook', 'grid-paper'] as const) {
      const m = getThemeMeta(id)
      expect(m.scrollMeterVariant).toBe('waveform')
      expect(m.motion.entry).toBe('wave')
      expect(m.motion.text).toBe('glitch-crt')
      expect(m.motion.shutdown).toBe('wave')
      expect(m.decorations).toBeUndefined()
    }
  })
  it('keeps the default theme dark + free', () => {
    expect(DEFAULT_THEME_ID).toBe('dotted-notebook')
    expect(getThemeMeta('dotted-notebook').colorScheme).toBe('dark')
    expect(getThemeMeta('dotted-notebook').tier).toBe('free')
  })
})
