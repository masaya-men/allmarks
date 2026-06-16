import { describe, it, expect } from 'vitest'
import { shouldSendQuickTag } from '../../extension/lib/quick-tag-gate.js'

describe('shouldSendQuickTag', () => {
  it('sends when enabled and PiP closed', () => {
    expect(shouldSendQuickTag({ quickTagEnabled: true, pipActive: false })).toBe(true)
  })
  it('suppresses when feature is OFF', () => {
    expect(shouldSendQuickTag({ quickTagEnabled: false, pipActive: false })).toBe(false)
  })
  it('suppresses when PiP is open (PiP card handles tagging)', () => {
    expect(shouldSendQuickTag({ quickTagEnabled: true, pipActive: true })).toBe(false)
  })
  it('treats missing quickTagEnabled as ON (back-compat with older save-iframe)', () => {
    expect(shouldSendQuickTag({ pipActive: false })).toBe(true)
  })
  it('treats missing pipActive as closed', () => {
    expect(shouldSendQuickTag({ quickTagEnabled: true })).toBe(true)
  })
})
