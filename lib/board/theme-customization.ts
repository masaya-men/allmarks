import type { ThemeId, ThemeCustomization, PatternType } from './types'
import { getThemeMeta } from './theme-registry'

/** Fully-resolved (no optionals) customization — the effective values used to
 *  paint the board. */
export type ResolvedThemeCustomization = {
  readonly edgeColor: string
  readonly boardColor: string
  readonly patternColor: string
  readonly patternType: PatternType
  readonly patternSize: number
}

/**
 * Per-theme DEFAULTS. These MUST equal the values hard-coded before this feature
 * existed so an untouched theme renders byte-identical:
 *  - Sound Wave: edge/board #0a0a0a (= --bg-outer / --bg-dark), no pattern.
 *  - Grid:       edge #0a0a0a, board #0e0e11, white grid lines @ 40px
 *                (= themes.module.css `.gridLines`).
 * Only 'pattern'-kind themes appear here; 'work' themes are fixed (not editable).
 */
export const THEME_CUSTOMIZATION_DEFAULTS: Partial<Record<ThemeId, ResolvedThemeCustomization>> = {
  'dotted-notebook': {
    edgeColor: '#0a0a0a',
    boardColor: '#0a0a0a',
    patternColor: 'rgba(255, 255, 255, 0.18)',
    patternType: 'none',
    patternSize: 40,
  },
  'grid-paper': {
    edgeColor: '#0a0a0a',
    boardColor: '#0e0e11',
    patternColor: 'rgba(255, 255, 255, 0.18)',
    patternType: 'grid',
    patternSize: 40,
  },
}

/** True when this theme exposes the CUSTOMIZE controls (= a 'pattern' theme with
 *  registered defaults). */
export function isCustomizableTheme(id: ThemeId): boolean {
  return getThemeMeta(id).kind === 'pattern' && id in THEME_CUSTOMIZATION_DEFAULTS
}

/**
 * Whether a theme exposes PATTERN controls (style / pattern colour / density) on
 * top of the always-present edge + board colour. Each theme gets the controls
 * that suit its identity:
 *  - Sound Wave (default): a clean, pattern-free board — edge + board colour only.
 *  - Grid: the pattern IS the theme — full controls.
 */
const THEMES_WITH_PATTERN_CONTROLS: ReadonlySet<ThemeId> = new Set<ThemeId>(['grid-paper'])
export function themeAllowsPattern(id: ThemeId): boolean {
  return THEMES_WITH_PATTERN_CONTROLS.has(id)
}

/** Merge a theme's defaults with the user's saved overrides into the effective
 *  values. Returns null for non-customizable (work) themes. */
export function resolveThemeCustomization(
  id: ThemeId,
  custom: ThemeCustomization | undefined,
): ResolvedThemeCustomization | null {
  const base = THEME_CUSTOMIZATION_DEFAULTS[id]
  if (!base) return null
  if (!custom) return base
  return {
    edgeColor: custom.edgeColor ?? base.edgeColor,
    boardColor: custom.boardColor ?? base.boardColor,
    patternColor: custom.patternColor ?? base.patternColor,
    patternType: custom.patternType ?? base.patternType,
    patternSize: custom.patternSize ?? base.patternSize,
  }
}

/** True when the saved override is empty / equal to defaults (so the theme is at
 *  its byte-identical baseline). Used to gate the "reset" affordance. */
export function isDefaultCustomization(id: ThemeId, custom: ThemeCustomization | undefined): boolean {
  const base = THEME_CUSTOMIZATION_DEFAULTS[id]
  if (!base || !custom) return true
  const r = resolveThemeCustomization(id, custom)
  if (!r) return true
  return (
    r.edgeColor === base.edgeColor &&
    r.boardColor === base.boardColor &&
    r.patternColor === base.patternColor &&
    r.patternType === base.patternType &&
    r.patternSize === base.patternSize
  )
}

/** Density slider bounds (pattern spacing in px). */
export const PATTERN_SIZE_MIN = 16
export const PATTERN_SIZE_MAX = 96

export const PATTERN_TYPES: ReadonlyArray<PatternType> = ['none', 'grid', 'diagonal', 'dots', 'crosshatch']

/** Curated swatches per slot — tasteful darks + a few expressive accents, so the
 *  picker reads as "expression tool", not a raw colour wheel. Custom colours go
 *  through the native picker (appended at the end of each row in the UI). */
export const EDGE_SWATCHES: ReadonlyArray<string> = [
  '#0a0a0a', '#000000', '#15140f', '#0d1413', '#161210', '#1c1c1f',
]
export const BOARD_SWATCHES: ReadonlyArray<string> = [
  '#0a0a0a', '#0e0e11', '#101015', '#13110b', '#0b1210', '#1a1a1a',
]
export const PATTERN_SWATCHES: ReadonlyArray<string> = [
  'rgba(255, 255, 255, 0.18)',
  'rgba(255, 255, 255, 0.32)',
  'rgba(255, 255, 255, 0.08)',
  'rgba(40, 241, 0, 0.22)',
  'rgba(255, 196, 120, 0.20)',
  'rgba(120, 180, 255, 0.20)',
]
