import { describe, it, expect } from 'vitest'
import { PRESETS, findActivePreset, type PresetId } from './tune-presets'

describe('PRESETS', () => {
  it('has exactly 5 entries', () => {
    expect(PRESETS.length).toBe(5)
  })

  it('has the expected ids in order (DENSE → AMBIENT)', () => {
    expect(PRESETS.map((p) => p.id)).toEqual([
      'dense',
      'tight',
      'default',
      'open',
      'ambient',
    ])
  })

  it('has unique (w, g) combinations', () => {
    const seen = new Set<string>()
    for (const p of PRESETS) {
      const key = `${p.w}|${p.g}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })

  it('keeps every w within slider range [120, 720]', () => {
    for (const p of PRESETS) {
      expect(p.w).toBeGreaterThanOrEqual(120)
      expect(p.w).toBeLessThanOrEqual(720)
    }
  })

  it('keeps every g within slider range [0, 300]', () => {
    for (const p of PRESETS) {
      expect(p.g).toBeGreaterThanOrEqual(0)
      expect(p.g).toBeLessThanOrEqual(300)
    }
  })

  it('default preset matches existing BOARD_SLIDERS defaults (267.84 / 97.21)', () => {
    const def = PRESETS.find((p) => p.id === 'default')!
    expect(def.w).toBe(267.84)
    expect(def.g).toBe(97.21)
  })
})

describe('findActivePreset', () => {
  it('returns the matching id when w and g equal a preset exactly', () => {
    expect(findActivePreset(267.84, 97.21)).toBe('default')
    expect(findActivePreset(207.80, 23.21)).toBe('dense')
    expect(findActivePreset(607.56, 147.87)).toBe('ambient')
  })

  it('returns the matching id within ±0.5 px tolerance', () => {
    expect(findActivePreset(267.50, 97.21)).toBe('default')
    expect(findActivePreset(267.84, 97.71)).toBe('default')
    expect(findActivePreset(268.34, 96.71)).toBe('default')
  })

  it('returns null when both axes are ≥0.51 px off', () => {
    expect(findActivePreset(267.84 + 0.51, 97.21 + 0.51)).toBeNull()
  })

  it('returns null when only one axis is within tolerance', () => {
    expect(findActivePreset(267.84, 90.00)).toBeNull()
    expect(findActivePreset(280.00, 97.21)).toBeNull()
  })

  it('PresetId type extends only the 5 expected ids', () => {
    const ids: PresetId[] = ['dense', 'tight', 'default', 'open', 'ambient']
    expect(ids.length).toBe(5)
  })
})
