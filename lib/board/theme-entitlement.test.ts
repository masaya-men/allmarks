import { describe, it, expect } from 'vitest'
import { isThemeUnlocked, EMPTY_LICENSES, isSyncUnlocked } from './theme-entitlement'
import type { ThemeMeta } from './types'
import type { LicenseState } from './license-store'

const free: ThemeMeta = { id: 'paper-atelier', direction: 'vertical', backgroundClassName: 'paperAtelier', labelKey: 'board.theme.paperAtelier', colorScheme: 'light', tier: 'free', kind: 'work', scrollMeterVariant: 'waveform', chromeMotion: 'quiet', motion: { entry: 'wave', text: 'glitch-crt', shutdown: 'wave' } }
const paid: ThemeMeta = { ...free, id: 'flat', tier: 'paid' }

describe('isThemeUnlocked', () => {
  it('free themes are always unlocked', () => {
    expect(isThemeUnlocked(free, EMPTY_LICENSES)).toBe(true)
  })
  it('paid themes are locked without a license', () => {
    expect(isThemeUnlocked(paid, EMPTY_LICENSES)).toBe(false)
  })
  it('paid themes unlock when their id is licensed', () => {
    expect(isThemeUnlocked(paid, new Set(['flat']))).toBe(true)
  })
})

describe('isSyncUnlocked', () => {
  it('locked when no license has ever been activated', () => {
    expect(isSyncUnlocked(null)).toBe(false)
  })
  it('locked when the license scope does not include sync', () => {
    const state: LicenseState = { kid: 'k', deviceId: 'd', scope: ['all-paid'], validatedAt: 1 }
    expect(isSyncUnlocked(state)).toBe(false)
  })
  it('unlocked when the license scope includes sync', () => {
    const state: LicenseState = { kid: 'k', deviceId: 'd', scope: ['sync'], validatedAt: 1 }
    expect(isSyncUnlocked(state)).toBe(true)
  })
})
