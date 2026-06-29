import { describe, it, expect } from 'vitest'
import {
  THEME_CUSTOMIZATION_DEFAULTS,
  resolveThemeCustomization,
  isCustomizableTheme,
  isDefaultCustomization,
  isLightColor,
} from './theme-customization'
import { patternSvgDataUri } from './theme-customization'

describe('theme-customization', () => {
  it('Sound Wave defaults are byte-identical to the pre-feature look (solid #0a0a0a, no pattern)', () => {
    const d = THEME_CUSTOMIZATION_DEFAULTS['dotted-notebook']!
    expect(d.edgeColor).toBe('#0a0a0a')
    expect(d.boardColor).toBe('#0a0a0a')
    expect(d.patternType).toBe('none')
    expect(d.titleColor).toBe('rgba(255, 255, 255, 0.95)')
  })

  it('isLightColor flags light surfaces (for dark-ink chrome on a light edge)', () => {
    expect(isLightColor('#ffffff')).toBe(true)
    expect(isLightColor('#fff')).toBe(true)
    expect(isLightColor('rgba(240, 240, 240, 1)')).toBe(true)
    expect(isLightColor('#0a0a0a')).toBe(false)
    expect(isLightColor('rgba(14, 14, 17, 1)')).toBe(false)
    expect(isLightColor('garbage')).toBe(false)
  })

  it('Grid defaults match the old gridLines (#0e0e11 board, white grid @ 40px)', () => {
    const d = THEME_CUSTOMIZATION_DEFAULTS['grid-paper']!
    expect(d.edgeColor).toBe('#0a0a0a')
    expect(d.boardColor).toBe('#0e0e11')
    expect(d.patternColor).toBe('rgba(255, 255, 255, 0.18)')
    expect(d.patternType).toBe('grid')
    expect(d.patternSize).toBe(40)
  })

  it('only pattern themes are customizable; the fixed work theme is not', () => {
    expect(isCustomizableTheme('dotted-notebook')).toBe(true)
    expect(isCustomizableTheme('grid-paper')).toBe(true)
    expect(isCustomizableTheme('paper-atelier')).toBe(false)
  })

  it('resolve returns null for non-customizable themes', () => {
    expect(resolveThemeCustomization('paper-atelier', undefined)).toBeNull()
  })

  it('resolve falls back to defaults for absent fields, overrides the rest', () => {
    const r = resolveThemeCustomization('dotted-notebook', { patternType: 'dots', patternColor: '#fff' })
    expect(r).not.toBeNull()
    expect(r!.patternType).toBe('dots')
    expect(r!.patternColor).toBe('#fff')
    expect(r!.boardColor).toBe('#0a0a0a') // untouched → default
  })

  it('isDefaultCustomization is true for undefined / equal-to-default overrides, false otherwise', () => {
    expect(isDefaultCustomization('grid-paper', undefined)).toBe(true)
    expect(isDefaultCustomization('grid-paper', { patternType: 'grid', patternSize: 40 })).toBe(true)
    expect(isDefaultCustomization('grid-paper', { patternType: 'dots' })).toBe(false)
    expect(isDefaultCustomization('dotted-notebook', { edgeColor: '#123456' })).toBe(false)
  })
})

describe('patternSvgDataUri', () => {
  it('returns empty for none', () => {
    expect(patternSvgDataUri({ patternType: 'none', patternColor: '#fff', patternSize: 40 })).toBe('')
  })
  it('encodes a tiling svg data-uri for grid', () => {
    const u = patternSvgDataUri({ patternType: 'grid', patternColor: 'rgba(255,255,255,0.18)', patternSize: 40 })
    expect(u.startsWith('data:image/svg+xml,')).toBe(true)
    expect(decodeURIComponent(u)).toContain('width=\'40\'')
  })
})
