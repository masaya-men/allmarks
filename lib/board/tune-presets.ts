/**
 * TUNE drawer preset definitions.
 *
 * Values were tuned by the user at 1489 CSS viewport to land just before
 * each column-count boundary (= ensures each preset fills the board at
 * maximum density for its tier). DEFAULT mirrors BOARD_SLIDERS defaults
 * so the existing reset behavior stays equivalent.
 *
 * Spec: docs/superpowers/specs/2026-05-20-tune-drawer-preset-design.md
 */

export type PresetId = 'dense' | 'tight' | 'default' | 'open' | 'ambient'

export type TunePreset = {
  readonly id: PresetId
  readonly label: string
  readonly w: number
  readonly g: number
}

export const PRESETS: readonly TunePreset[] = [
  { id: 'dense', label: 'DENSE', w: 207.80, g: 23.21 },
  { id: 'tight', label: 'TIGHT', w: 220.03, g: 65.70 },
  { id: 'default', label: 'DEFAULT', w: 267.84, g: 97.21 },
  { id: 'open', label: 'OPEN', w: 412.74, g: 62.38 },
  { id: 'ambient', label: 'AMBIENT', w: 607.56, g: 147.87 },
] as const

/** ±0.5 px tolerance absorbs float-rounding noise from GSAP tweens. */
const MATCH_TOLERANCE_PX = 0.5

/**
 * Returns the id of the preset matching (w, g) within ±0.5 px on both
 * axes. Returns null if w or g is outside tolerance of every preset.
 * The 5 presets are guaranteed unique so at most one match is possible.
 */
export function findActivePreset(w: number, g: number): PresetId | null {
  for (const preset of PRESETS) {
    if (
      Math.abs(w - preset.w) <= MATCH_TOLERANCE_PX &&
      Math.abs(g - preset.g) <= MATCH_TOLERANCE_PX
    ) {
      return preset.id
    }
  }
  return null
}
