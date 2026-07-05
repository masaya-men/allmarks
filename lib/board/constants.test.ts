import { describe, it, expect } from 'vitest'
import { BOARD_Z_INDEX } from './constants'

describe('BOARD_Z_INDEX.CHROME_DRAWER', () => {
  it('sits above the canvas ScrollMeter (400) and toolbar (110)', () => {
    expect(BOARD_Z_INDEX.CHROME_DRAWER).toBeGreaterThan(400)
    expect(BOARD_Z_INDEX.CHROME_DRAWER).toBeGreaterThan(BOARD_Z_INDEX.TOOLBAR)
  })
  it('sits below the onboarding spotlight ring (410)', () => {
    expect(BOARD_Z_INDEX.CHROME_DRAWER).toBeLessThan(BOARD_Z_INDEX.ONBOARDING_SPOTLIGHT_RING)
  })
})
