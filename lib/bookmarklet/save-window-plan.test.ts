import { describe, it, expect } from 'vitest'
import { planSaveWindow, SAVED_AUTOCLOSE_MS, ERROR_AUTOCLOSE_MS } from './save-window-plan'

describe('planSaveWindow', () => {
  it('error → no tags, auto-close at error timing', () => {
    expect(planSaveWindow('error', true, false)).toEqual({ showTags: false, autoCloseMs: ERROR_AUTOCLOSE_MS })
  })
  it('saved + enabled + no PiP → tags, no auto-close (lifecycle owns close)', () => {
    expect(planSaveWindow('saved', true, false)).toEqual({ showTags: true, autoCloseMs: null })
  })
  it('duplicate + enabled + no PiP → tags, no auto-close', () => {
    expect(planSaveWindow('duplicate', true, false)).toEqual({ showTags: true, autoCloseMs: null })
  })
  it('saved + disabled → no tags, auto-close at saved timing', () => {
    expect(planSaveWindow('saved', false, false)).toEqual({ showTags: false, autoCloseMs: SAVED_AUTOCLOSE_MS })
  })
  it('saved + enabled + PiP open → no tags (PiP is the tag surface), auto-close', () => {
    expect(planSaveWindow('saved', true, true)).toEqual({ showTags: false, autoCloseMs: SAVED_AUTOCLOSE_MS })
  })
})
