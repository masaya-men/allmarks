import { describe, it, expect } from 'vitest'
import { isThemeUnlocked, EMPTY_LICENSES } from './theme-entitlement'
import type { ThemeMeta } from './types'

const free: ThemeMeta = { id: 'paper-atelier', direction: 'vertical', backgroundClassName: 'paperAtelier', labelKey: 'board.theme.paperAtelier', colorScheme: 'light', tier: 'free' }
const paid: ThemeMeta = { ...free, id: 'grid-paper', tier: 'paid' }

describe('isThemeUnlocked', () => {
  it('free themes are always unlocked', () => {
    expect(isThemeUnlocked(free, EMPTY_LICENSES)).toBe(true)
  })
  it('paid themes are locked without a license', () => {
    expect(isThemeUnlocked(paid, EMPTY_LICENSES)).toBe(false)
  })
  it('paid themes unlock when their id is licensed', () => {
    expect(isThemeUnlocked(paid, new Set(['grid-paper']))).toBe(true)
  })
})
