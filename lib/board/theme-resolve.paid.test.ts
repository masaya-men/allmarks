import { describe, it, expect, vi } from 'vitest'
import type { ThemeId } from './types'

// The real registry has only free themes, so the paid/locked fallback branch of
// resolveThemeId is unreachable with real data. Mock the registry with a paid
// theme to exercise that branch directly. isThemeUnlocked stays real (Task 2
// already tests it), so this verifies resolveThemeId correctly threads the
// license set through to the entitlement check.
vi.mock('./theme-registry', () => {
  const REG = {
    'free-a': { id: 'free-a', direction: 'vertical', backgroundClassName: 'a', labelKey: 'board.theme.freeA', colorScheme: 'dark', tier: 'free', scrollMeterVariant: 'waveform', motion: { entry: 'wave', text: 'glitch-crt', shutdown: 'wave' } },
    'paid-x': { id: 'paid-x', direction: 'vertical', backgroundClassName: 'x', labelKey: 'board.theme.paidX', colorScheme: 'light', tier: 'paid', scrollMeterVariant: 'waveform', motion: { entry: 'wave', text: 'glitch-crt', shutdown: 'wave' } },
  }
  return {
    THEME_REGISTRY: REG,
    DEFAULT_THEME_ID: 'free-a',
    getThemeMeta: (id: string) => REG[id as keyof typeof REG],
    listThemeIds: () => Object.keys(REG),
  }
})

import { resolveThemeId } from './theme-resolve'

describe('resolveThemeId — paid/locked branch', () => {
  it('falls back to default when a known paid theme is not licensed', () => {
    expect(resolveThemeId('paid-x', new Set())).toBe('free-a')
  })
  it('keeps a known paid theme when it is licensed', () => {
    expect(resolveThemeId('paid-x', new Set(['paid-x'] as unknown as ThemeId[]))).toBe('paid-x')
  })
  it('keeps a known free theme regardless of licenses', () => {
    expect(resolveThemeId('free-a', new Set())).toBe('free-a')
  })
})
