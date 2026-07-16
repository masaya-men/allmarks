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
  readonly patternStroke: number
  readonly titleColor: string
  readonly boardRounded: boolean
}

/** The thickness each pattern was drawn at before the slider existed: 1px stroke
 *  for the line patterns, 1.4px radius for the dots. `dots` differs because its
 *  number is a circle radius, not a stroke width. */
export function defaultPatternStroke(type: PatternType): number {
  return type === 'dots' ? 1.4 : 1
}

/** The default hero-typography colour (= BoardBackgroundTypography's
 *  --bg-typo-color fallback). Shared by both pattern themes so an untouched
 *  Title is byte-identical. */
const DEFAULT_TITLE_COLOR = 'rgba(255, 255, 255, 0.95)'

/**
 * Per-theme DEFAULTS. These MUST equal the values hard-coded before this feature
 * existed so an untouched theme renders byte-identical:
 *  - Sound Wave: edge/board #0a0a0a (= --bg-outer / --bg-dark), no pattern.
 *  - Flat:       light editorial board, no pattern by default.
 * Grid was a standalone theme (edge #0a0a0a, board #0e0e11, white grid @ 40px);
 * it is retired and migrated to Sound Wave + a grid customization (board-config.ts)
 * — see GRID_MIGRATION_CUSTOMIZATION below.
 * Only 'pattern'-kind themes appear here; 'work' themes are fixed (not editable).
 */
export const THEME_CUSTOMIZATION_DEFAULTS: Partial<Record<ThemeId, ResolvedThemeCustomization>> = {
  'dotted-notebook': {
    edgeColor: '#0a0a0a',
    boardColor: '#0a0a0a',
    patternColor: 'rgba(255, 255, 255, 0.18)',
    patternType: 'none',
    patternSize: 40,
    patternStroke: 1,
    titleColor: DEFAULT_TITLE_COLOR,
    boardRounded: false, // square frame (= --canvas-radius 0px at :root)
  },
  flat: {
    edgeColor: '#ffffff',      // pure-white margin (user-chosen default)
    boardColor: '#faf9f6',
    patternColor: 'rgba(20, 19, 15, 0.10)',
    patternType: 'none',
    patternSize: 40,
    patternStroke: 1,
    titleColor: 'rgba(20, 19, 15, 0.55)',
    boardRounded: true,        // rounded board frame by default
  },
}

/** True when this theme exposes the CUSTOMIZE controls (= a 'pattern' theme with
 *  registered defaults). */
export function isCustomizableTheme(id: ThemeId): boolean {
  return getThemeMeta(id).kind === 'pattern' && id in THEME_CUSTOMIZATION_DEFAULTS
}

/**
 * Whether a theme exposes PATTERN controls (style / pattern colour / density) on
 * top of the always-present edge + board colour. Both live-world 'pattern' themes
 * get them — grid/dots/etc. are a customization, not a separate theme:
 *  - Sound Wave: pattern-free by default (patternType 'none'), but the user can
 *    add a grid (this is what the retired Grid theme became).
 *  - Flat: same, on the light editorial board.
 */
const THEMES_WITH_PATTERN_CONTROLS: ReadonlySet<ThemeId> = new Set<ThemeId>(['dotted-notebook', 'flat'])
export function themeAllowsPattern(id: ThemeId): boolean {
  return THEMES_WITH_PATTERN_CONTROLS.has(id)
}

/** The customization that reproduces the retired Grid theme on Sound Wave (its
 *  board #0e0e11 + a white grid). board-config's migration writes this into the
 *  dotted-notebook slot for anyone whose saved theme was 'grid-paper', so their
 *  board stays pixel-identical. edge/title match Sound Wave's defaults, so they
 *  resolve from there and don't need overriding here. */
export const GRID_MIGRATION_CUSTOMIZATION: ThemeCustomization = {
  boardColor: '#0e0e11',
  patternType: 'grid',
  patternColor: 'rgba(255, 255, 255, 0.18)',
  patternSize: 40,
  patternStroke: 1,
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
  // Stroke falls back per PATTERN TYPE, not per theme: switching a grid theme to
  // dots without touching the slider must still draw the historic r=1.4 circle.
  const patternType = custom.patternType ?? base.patternType
  return {
    edgeColor: custom.edgeColor ?? base.edgeColor,
    boardColor: custom.boardColor ?? base.boardColor,
    patternColor: custom.patternColor ?? base.patternColor,
    patternType,
    patternSize: custom.patternSize ?? base.patternSize,
    patternStroke: custom.patternStroke ?? defaultPatternStroke(patternType),
    titleColor: custom.titleColor ?? base.titleColor,
    boardRounded: custom.boardRounded ?? base.boardRounded,
  }
}

/** Thickness slider bounds (px). */
export const PATTERN_STROKE_MIN = 1
export const PATTERN_STROKE_MAX = 6

/**
 * The thickness actually painted. A stroke wider than half the spacing fills the
 * tile solid — at PATTERN_SIZE_MIN (16px) a 6px grid line would leave a 4px gap,
 * and a share can carry a spacing as low as 8px. Cap it, and never go below a
 * hairline. Both the live board's CSS var and the share's SVG go through here so
 * a collage and the link it produced can't disagree on line weight.
 */
export function effectivePatternStroke(stroke: number, patternSize: number): number {
  return Math.max(0.5, Math.min(stroke, patternSize / 2 - 1))
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
    r.patternSize === base.patternSize &&
    r.patternStroke === base.patternStroke &&
    r.titleColor === base.titleColor &&
    r.boardRounded === base.boardRounded
  )
}

/** Rough perceived-luminance test for a CSS colour (hex or rgb/rgba). Used to
 *  flip edge-band chrome text to dark ink when the user picks a light edge (so
 *  the wordmark / MOTION labels stay legible instead of vanishing white-on-white
 *  with a stray dark text-stroke). Unknown formats default to "dark". */
export function isLightColor(color: string): boolean {
  let r = 0, g = 0, b = 0
  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) {
    const h = hex[1]
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
    r = parseInt(full.slice(0, 2), 16)
    g = parseInt(full.slice(2, 4), 16)
    b = parseInt(full.slice(4, 6), 16)
  } else {
    const m = color.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i)
    if (!m) return false
    r = Number(m[1]); g = Number(m[2]); b = Number(m[3])
  }
  // Rec.601 luma; > ~0.6 reads as a light surface needing dark ink.
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6
}

/** Density slider bounds (pattern spacing in px). */
export const PATTERN_SIZE_MIN = 16
export const PATTERN_SIZE_MAX = 96

export const PATTERN_TYPES: ReadonlyArray<PatternType> = ['none', 'grid', 'diagonal', 'dots', 'crosshatch']

/* Curated swatches per slot — the picker reads as "expression tool", not a raw
   colour wheel. Two board-brightness sets: DARK for the dark world (Sound Wave)
   and LIGHT for the light editorial world (Flat). Each set's FIRST entry is that
   world's default colour, so opening CUSTOMIZE highlights the current swatch
   instead of pre-selecting the "+" custom chip. Custom colours still go through
   the native picker (appended after each row in the UI). */

// ── Dark world (Sound Wave) — unchanged values (byte-identical) ──
export const EDGE_SWATCHES_DARK: ReadonlyArray<string> = [
  '#0a0a0a', '#000000', '#15140f', '#0d1413', '#161210', '#1c1c1f',
]
export const BOARD_SWATCHES_DARK: ReadonlyArray<string> = [
  '#0a0a0a', '#0e0e11', '#101015', '#13110b', '#0b1210', '#1a1a1a',
]
export const PATTERN_SWATCHES_DARK: ReadonlyArray<string> = [
  'rgba(255, 255, 255, 0.18)',
  'rgba(255, 255, 255, 0.32)',
  'rgba(255, 255, 255, 0.08)',
  'rgba(40, 241, 0, 0.22)',
  'rgba(255, 196, 120, 0.20)',
  'rgba(120, 180, 255, 0.20)',
]
export const TITLE_SWATCHES_DARK: ReadonlyArray<string> = [
  'rgba(255, 255, 255, 0.95)',
  '#ffffff',
  '#111111',
  '#28f100',
  '#ffc478',
  '#78b4ff',
]

// ── Light world (Flat) — first entry = Flat's default. Board + pattern carry the
//    user's picked palette (Mint Julep / Starship / Corn Field boards; Highland /
//    Jelly Bean / Tickle-Me-Pink patterns); edge + title stay neutral, since the
//    low-contrast pairs would be illegible as a wordmark. ──
export const EDGE_SWATCHES_LIGHT: ReadonlyArray<string> = [
  '#ffffff', '#f1efe8', '#eae6df', '#e9e4d9', '#efece4', '#e4e0d6',
]
export const BOARD_SWATCHES_LIGHT: ReadonlyArray<string> = [
  '#faf9f6', '#ffffff', '#f0f1be', '#cff740', '#f8f7c8',
]
export const PATTERN_SWATCHES_LIGHT: ReadonlyArray<string> = [
  'rgba(20, 19, 15, 0.10)',
  '#749469',
  '#227798',
  '#fd8ab6',
]
export const TITLE_SWATCHES_LIGHT: ReadonlyArray<string> = [
  'rgba(20, 19, 15, 0.55)',
  '#14130f',
  '#57544c',
  '#6b675e',
  '#1c9a00',
]

export type ThemeSwatchSets = {
  readonly edge: ReadonlyArray<string>
  readonly board: ReadonlyArray<string>
  readonly pattern: ReadonlyArray<string>
  readonly title: ReadonlyArray<string>
}
/** Pick the swatch sets for a board world by its colour scheme. */
export function swatchesForScheme(scheme: 'dark' | 'light'): ThemeSwatchSets {
  return scheme === 'light'
    ? { edge: EDGE_SWATCHES_LIGHT, board: BOARD_SWATCHES_LIGHT, pattern: PATTERN_SWATCHES_LIGHT, title: TITLE_SWATCHES_LIGHT }
    : { edge: EDGE_SWATCHES_DARK, board: BOARD_SWATCHES_DARK, pattern: PATTERN_SWATCHES_DARK, title: TITLE_SWATCHES_DARK }
}

/** Build a single-layer tiling SVG (data-URI) for a pattern. Used by the share
 *  preview + OG capture so dom-to-image renders the pattern faithfully (it drops
 *  one direction of stacked CSS gradients — see 2026-06-29 spike). Mirrors
 *  themes.module.css `.patternLayer[data-pattern]` geometry. `none` → ''. */
export function patternSvgDataUri(c: {
  readonly patternType: PatternType
  readonly patternColor: string
  readonly patternSize: number
  readonly patternStroke?: number
}): string {
  const s = c.patternSize
  const col = c.patternColor
  const t = effectivePatternStroke(c.patternStroke ?? defaultPatternStroke(c.patternType), s)
  let body: string
  switch (c.patternType) {
    case 'none':
      return ''
    case 'grid':
      // line on the right + bottom edge so the tile repeats into a full grid
      body = `<path d='M${s} 0V${s}M0 ${s}H${s}' stroke='${col}' stroke-width='${t}' fill='none'/>`
      break
    case 'dots':
      body = `<circle cx='${s / 2}' cy='${s / 2}' r='${t}' fill='${col}'/>`
      break
    case 'diagonal':
      // 45° line through the tile; tiling continues the stripe
      body = `<path d='M0 ${s}L${s} 0' stroke='${col}' stroke-width='${t}' fill='none'/>`
      break
    case 'crosshatch':
      body = `<path d='M0 ${s}L${s} 0M0 0L${s} ${s}' stroke='${col}' stroke-width='${t}' fill='none'/>`
      break
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}'>${body}</svg>`
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}
