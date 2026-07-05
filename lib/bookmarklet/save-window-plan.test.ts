import { describe, it, expect } from 'vitest'
import {
  planSaveWindow,
  isOpenedAsTab,
  SAVED_AUTOCLOSE_MS,
  ERROR_AUTOCLOSE_MS,
  TAB_MINIMAL_CLOSE_MS,
  TAB_CONFIRM_CLOSE_MS,
} from './save-window-plan'

// Windowed (small popup) path — openedAsTab=false, noticeSeen irrelevant.
describe('planSaveWindow — windowed (small popup)', () => {
  it('error → no tags, no explanation, auto-close at error timing', () => {
    expect(planSaveWindow('error', true, false, false, false)).toEqual({
      mode: 'normal', showTags: false, showExplanation: false, autoCloseMs: ERROR_AUTOCLOSE_MS,
    })
  })
  it('saved + enabled + no PiP → tags, no auto-close (lifecycle owns close)', () => {
    expect(planSaveWindow('saved', true, false, false, false)).toEqual({
      mode: 'normal', showTags: true, showExplanation: false, autoCloseMs: null,
    })
  })
  it('duplicate + enabled + no PiP → tags, no auto-close', () => {
    expect(planSaveWindow('duplicate', true, false, false, false)).toEqual({
      mode: 'normal', showTags: true, showExplanation: false, autoCloseMs: null,
    })
  })
  it('saved + disabled → no tags, auto-close at saved timing', () => {
    expect(planSaveWindow('saved', false, false, false, false)).toEqual({
      mode: 'normal', showTags: false, showExplanation: false, autoCloseMs: SAVED_AUTOCLOSE_MS,
    })
  })
  it('saved + enabled + PiP open → no tags (PiP is the tag surface), auto-close', () => {
    expect(planSaveWindow('saved', true, true, false, false)).toEqual({
      mode: 'normal', showTags: false, showExplanation: false, autoCloseMs: SAVED_AUTOCLOSE_MS,
    })
  })
})

// Tab path — openedAsTab=true (macOS fullscreen forces a tab).
describe('planSaveWindow — opened as tab (fullscreen)', () => {
  it('PiP open → minimal, close fast, no tags/explanation (PopOut shows the card)', () => {
    expect(planSaveWindow('saved', true, true, true, false)).toEqual({
      mode: 'tab-minimal', showTags: false, showExplanation: false, autoCloseMs: TAB_MINIMAL_CLOSE_MS,
    })
  })
  it('no PiP + notice unseen → explain, manual close, no tags', () => {
    expect(planSaveWindow('saved', true, false, true, false)).toEqual({
      mode: 'tab-explain', showTags: false, showExplanation: true, autoCloseMs: null,
    })
  })
  it('no PiP + notice already seen → quiet confirm, auto-close, no tags', () => {
    expect(planSaveWindow('saved', true, false, true, true)).toEqual({
      mode: 'tab-confirm', showTags: false, showExplanation: false, autoCloseMs: TAB_CONFIRM_CLOSE_MS,
    })
  })
  it('duplicate behaves like saved in tab mode (unseen → explain)', () => {
    expect(planSaveWindow('duplicate', true, false, true, false)).toEqual({
      mode: 'tab-explain', showTags: false, showExplanation: true, autoCloseMs: null,
    })
  })
  it('tag setting is ignored in tab mode — disabled still confirms quietly when seen', () => {
    expect(planSaveWindow('saved', false, false, true, true)).toEqual({
      mode: 'tab-confirm', showTags: false, showExplanation: false, autoCloseMs: TAB_CONFIRM_CLOSE_MS,
    })
  })
  it('error in tab mode → normal error handling, no explanation', () => {
    expect(planSaveWindow('error', true, false, true, false)).toEqual({
      mode: 'normal', showTags: false, showExplanation: false, autoCloseMs: ERROR_AUTOCLOSE_MS,
    })
  })
})

describe('isOpenedAsTab', () => {
  it('intended 256x256 popup → false', () => {
    expect(isOpenedAsTab({ innerWidth: 256, innerHeight: 256 })).toBe(false)
  })
  it('slightly larger popup still within popup range → false', () => {
    expect(isOpenedAsTab({ innerWidth: 300, innerHeight: 400 })).toBe(false)
  })
  it('full desktop tab → true (wide)', () => {
    expect(isOpenedAsTab({ innerWidth: 1440, innerHeight: 900 })).toBe(true)
  })
  it('tall tab → true (tall)', () => {
    expect(isOpenedAsTab({ innerWidth: 400, innerHeight: 1000 })).toBe(true)
  })
})
