import { describe, it, expect } from 'vitest'
import {
  THEME_CUSTOMIZATION_DEFAULTS,
  GRID_MIGRATION_CUSTOMIZATION,
  resolveThemeCustomization,
  isCustomizableTheme,
  isDefaultCustomization,
  isLightColor,
} from './theme-customization'
import { patternSvgDataUri, defaultPatternStroke, effectivePatternStroke } from './theme-customization'

describe('theme-customization', () => {
  it('Sound Wave defaults are byte-identical to the pre-feature look (solid #0a0a0a, no pattern, square frame)', () => {
    const d = THEME_CUSTOMIZATION_DEFAULTS['dotted-notebook']!
    expect(d.edgeColor).toBe('#0a0a0a')
    expect(d.boardColor).toBe('#0a0a0a')
    expect(d.patternType).toBe('none')
    expect(d.titleColor).toBe('rgba(255, 255, 255, 0.95)')
    expect(d.boardRounded).toBe(false) // square frame (= --canvas-radius 0px)
  })

  it('Flat defaults to a pure-white margin + rounded board frame (user-chosen default)', () => {
    const d = THEME_CUSTOMIZATION_DEFAULTS['flat']!
    expect(d.edgeColor).toBe('#ffffff')
    expect(d.boardRounded).toBe(true)
  })

  it('boardRounded (board-frame corners) resolves and gates the reset like any other field', () => {
    // Sound Wave defaults to a square frame; flipping it marks the theme non-default.
    expect(THEME_CUSTOMIZATION_DEFAULTS['dotted-notebook']!.boardRounded).toBe(false)
    const r = resolveThemeCustomization('dotted-notebook', { boardRounded: true })!
    expect(r.boardRounded).toBe(true)
    expect(isDefaultCustomization('dotted-notebook', { boardRounded: true })).toBe(false)
    // explicitly matching the default is still the default (square for Sound Wave)
    expect(isDefaultCustomization('dotted-notebook', { boardRounded: false })).toBe(true)
  })

  it('isLightColor flags light surfaces (for dark-ink chrome on a light edge)', () => {
    expect(isLightColor('#ffffff')).toBe(true)
    expect(isLightColor('#fff')).toBe(true)
    expect(isLightColor('rgba(240, 240, 240, 1)')).toBe(true)
    expect(isLightColor('#0a0a0a')).toBe(false)
    expect(isLightColor('rgba(14, 14, 17, 1)')).toBe(false)
    expect(isLightColor('garbage')).toBe(false)
  })

  it('the retired Grid migrates to Sound Wave + a grid customization that reproduces it (#0e0e11 board, white grid @ 40px)', () => {
    const r = resolveThemeCustomization('dotted-notebook', GRID_MIGRATION_CUSTOMIZATION)!
    expect(r.edgeColor).toBe('#0a0a0a') // Sound Wave default edge
    expect(r.boardColor).toBe('#0e0e11')
    expect(r.patternColor).toBe('rgba(255, 255, 255, 0.18)')
    expect(r.patternType).toBe('grid')
    expect(r.patternSize).toBe(40)
  })

  it('only pattern themes are customizable; the fixed work theme is not', () => {
    expect(isCustomizableTheme('dotted-notebook')).toBe(true)
    expect(isCustomizableTheme('flat')).toBe(true)
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
    expect(isDefaultCustomization('dotted-notebook', undefined)).toBe(true)
    expect(isDefaultCustomization('dotted-notebook', { patternType: 'none', patternSize: 40 })).toBe(true)
    expect(isDefaultCustomization('dotted-notebook', { patternType: 'grid' })).toBe(false)
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

/** The thickness slider. Its whole contract is that a board which never touches
 *  it paints exactly as it always did, so the default cases below are regression
 *  guards on literal SVG output. */
describe('pattern thickness', () => {
  const svg = (c: Parameters<typeof patternSvgDataUri>[0]): string => decodeURIComponent(patternSvgDataUri(c))

  it('defaults to a 1px stroke for line patterns and a 1.4px radius for dots', () => {
    expect(defaultPatternStroke('grid')).toBe(1)
    expect(defaultPatternStroke('diagonal')).toBe(1)
    expect(defaultPatternStroke('crosshatch')).toBe(1)
    expect(defaultPatternStroke('dots')).toBe(1.4)
  })

  it('an absent stroke reproduces the pre-slider SVG exactly', () => {
    expect(svg({ patternType: 'grid', patternColor: '#fff', patternSize: 40 })).toContain("stroke-width='1'")
    expect(svg({ patternType: 'diagonal', patternColor: '#fff', patternSize: 40 })).toContain("stroke-width='1'")
    expect(svg({ patternType: 'crosshatch', patternColor: '#fff', patternSize: 40 })).toContain("stroke-width='1'")
    expect(svg({ patternType: 'dots', patternColor: '#fff', patternSize: 40 })).toContain("r='1.4'")
  })

  it('carries a chosen stroke into the SVG', () => {
    expect(svg({ patternType: 'grid', patternColor: '#fff', patternSize: 40, patternStroke: 3.5 })).toContain("stroke-width='3.5'")
    expect(svg({ patternType: 'dots', patternColor: '#fff', patternSize: 40, patternStroke: 4 })).toContain("r='4'")
  })

  it('resolves the stroke from the PATTERN TYPE, so switching to dots keeps r=1.4', () => {
    expect(resolveThemeCustomization('dotted-notebook', { patternType: 'dots' })!.patternStroke).toBe(1.4)
    expect(resolveThemeCustomization('dotted-notebook', undefined)!.patternStroke).toBe(1)
    expect(resolveThemeCustomization('dotted-notebook', { patternStroke: 4 })!.patternStroke).toBe(4)
  })

  it('clamps the stroke below half the spacing so a dense pattern never fills solid', () => {
    expect(effectivePatternStroke(1, 40)).toBe(1)
    expect(effectivePatternStroke(6, 40)).toBe(6)
    expect(effectivePatternStroke(6, 16)).toBe(6) // 16/2 − 1 = 7 → untouched
    expect(effectivePatternStroke(6, 12)).toBe(5) // 12/2 − 1 = 5 → capped
    expect(effectivePatternStroke(6, 8)).toBe(3) // the share schema's floor spacing
    expect(effectivePatternStroke(1, 2)).toBe(0.5) // never thinner than a hairline
  })

  it('applies the clamp inside the SVG, matching what the CSS var will carry', () => {
    expect(svg({ patternType: 'grid', patternColor: '#fff', patternSize: 8, patternStroke: 6 })).toContain("stroke-width='3'")
  })
})
