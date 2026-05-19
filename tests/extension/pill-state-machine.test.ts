import { describe, it, expect } from 'vitest'
import { pillStateView, PILL_STATES } from '../../extension/lib/pill-state-machine.js'

describe('pillStateView', () => {
  it('returns Saving / ring / null autoHide for saving', () => {
    const v = pillStateView('saving')
    expect(v).toEqual({ label: 'Saving', icon: 'ring', autoHideMs: null })
  })

  it('returns Saved / check / 1700ms for saved', () => {
    const v = pillStateView('saved')
    expect(v).toEqual({ label: 'Saved', icon: 'check', autoHideMs: 1700 })
  })

  it('returns Already saved / check / 2000ms for duplicate', () => {
    const v = pillStateView('duplicate')
    expect(v).toEqual({ label: 'Already saved', icon: 'check', autoHideMs: 2000 })
  })

  it('returns Failed / bang / 2400ms for error', () => {
    const v = pillStateView('error')
    expect(v).toEqual({ label: 'Failed', icon: 'bang', autoHideMs: 2400 })
  })

  it('returns null for unknown state', () => {
    expect(pillStateView('???')).toBeNull()
    expect(pillStateView('')).toBeNull()
  })

  it('PILL_STATES exposes the 4 valid states', () => {
    expect(PILL_STATES).toEqual(['saving', 'saved', 'duplicate', 'error'])
  })
})
