import { describe, it, expect } from 'vitest'
import {
  initialState,
  nextState,
  visualState,
  FLASH_MS,
  ERROR_MS,
} from '../../extension/lib/floating-button-state.js'

describe('initialState', () => {
  it('starts unsaved and idle', () => {
    expect(initialState()).toEqual({ savedFlag: false, pillState: 'idle' })
  })
})

describe('nextState — mouse events', () => {
  it('idle -> hover on mouseenter', () => {
    const s = nextState(initialState(), { type: 'mouseenter' })
    expect(s.pillState).toBe('hover')
  })

  it('hover -> idle on mouseleave', () => {
    const s = nextState({ savedFlag: false, pillState: 'hover' }, { type: 'mouseleave' })
    expect(s.pillState).toBe('idle')
  })

  it('mouseenter is no-op when not in idle', () => {
    const s = nextState({ savedFlag: false, pillState: 'saving' }, { type: 'mouseenter' })
    expect(s.pillState).toBe('saving')
  })

  it('mouseleave is no-op when not in hover', () => {
    const s = nextState({ savedFlag: false, pillState: 'idle' }, { type: 'mouseleave' })
    expect(s.pillState).toBe('idle')
  })

  it('preserves savedFlag on mouseenter/leave', () => {
    let s = { savedFlag: true, pillState: 'idle' }
    s = nextState(s, { type: 'mouseenter' })
    expect(s).toEqual({ savedFlag: true, pillState: 'hover' })
    s = nextState(s, { type: 'mouseleave' })
    expect(s).toEqual({ savedFlag: true, pillState: 'idle' })
  })
})

describe('nextState — click', () => {
  it('idle -> saving on click', () => {
    const s = nextState(initialState(), { type: 'click' })
    expect(s.pillState).toBe('saving')
  })

  it('hover -> saving on click', () => {
    const s = nextState({ savedFlag: false, pillState: 'hover' }, { type: 'click' })
    expect(s.pillState).toBe('saving')
  })

  it('saving click is ignored (no double-fire)', () => {
    const s = nextState({ savedFlag: false, pillState: 'saving' }, { type: 'click' })
    expect(s.pillState).toBe('saving')
  })

  it('flash click is ignored (so the user does not re-trigger during reveal)', () => {
    const s = nextState({ savedFlag: false, pillState: 'flash' }, { type: 'click' })
    expect(s.pillState).toBe('flash')
  })

  it('error -> saving on click (retry)', () => {
    const s = nextState({ savedFlag: false, pillState: 'error' }, { type: 'click' })
    expect(s.pillState).toBe('saving')
  })

  it('already-saved (savedFlag) is still clickable for re-save attempt', () => {
    const s = nextState({ savedFlag: true, pillState: 'idle' }, { type: 'click' })
    expect(s.pillState).toBe('saving')
  })
})

describe('nextState — save outcome', () => {
  it('saving -> flash on save-success and sets savedFlag', () => {
    const s = nextState({ savedFlag: false, pillState: 'saving' }, { type: 'save-success' })
    expect(s).toEqual({ savedFlag: true, pillState: 'flash' })
  })

  it('saving -> error on save-error', () => {
    const s = nextState({ savedFlag: false, pillState: 'saving' }, { type: 'save-error' })
    expect(s).toEqual({ savedFlag: false, pillState: 'error' })
  })

  it('save-success outside saving is no-op (defensive)', () => {
    const s = nextState({ savedFlag: false, pillState: 'idle' }, { type: 'save-success' })
    expect(s).toEqual({ savedFlag: false, pillState: 'idle' })
  })

  it('save-error outside saving is no-op', () => {
    const s = nextState({ savedFlag: false, pillState: 'idle' }, { type: 'save-error' })
    expect(s).toEqual({ savedFlag: false, pillState: 'idle' })
  })
})

describe('nextState — timers', () => {
  it('flash -> idle on flash-elapsed (savedFlag preserved)', () => {
    const s = nextState({ savedFlag: true, pillState: 'flash' }, { type: 'flash-elapsed' })
    expect(s).toEqual({ savedFlag: true, pillState: 'idle' })
  })

  it('error -> idle on error-elapsed (savedFlag preserved)', () => {
    const s = nextState({ savedFlag: false, pillState: 'error' }, { type: 'error-elapsed' })
    expect(s).toEqual({ savedFlag: false, pillState: 'idle' })
  })

  it('flash-elapsed outside flash is no-op', () => {
    const s = nextState({ savedFlag: false, pillState: 'idle' }, { type: 'flash-elapsed' })
    expect(s).toEqual({ savedFlag: false, pillState: 'idle' })
  })
})

describe('nextState — mirror-hit-initial (page load)', () => {
  it('sets savedFlag silently on mirror-hit-initial', () => {
    const s = nextState({ savedFlag: false, pillState: 'idle' }, { type: 'mirror-hit-initial' })
    expect(s).toEqual({ savedFlag: true, pillState: 'idle' })
  })

  it('mirror-hit-initial during hover keeps hover (no flash)', () => {
    const s = nextState({ savedFlag: false, pillState: 'hover' }, { type: 'mirror-hit-initial' })
    expect(s).toEqual({ savedFlag: true, pillState: 'hover' })
  })
})

describe('nextState — mirror-hit-live (saved via another path on this page)', () => {
  it('sets savedFlag AND triggers flash so the user sees a transition', () => {
    const s = nextState({ savedFlag: false, pillState: 'idle' }, { type: 'mirror-hit-live' })
    expect(s).toEqual({ savedFlag: true, pillState: 'flash' })
  })

  it('mirror-hit-live during hover still runs the flash (= primary visual feedback)', () => {
    // hover -> flash transition, so the user sees the reveal animation even
    // if their cursor was hovering the button when the save happened.
    const s = nextState({ savedFlag: false, pillState: 'hover' }, { type: 'mirror-hit-live' })
    expect(s).toEqual({ savedFlag: true, pillState: 'flash' })
  })

  it('mirror-hit-live when already saved is a no-op', () => {
    // Re-saving the same URL (= dispatch flips savedUrlsMirror entry's
    // timestamp) must not re-flash, or every dedupe save would replay the
    // animation on revisit.
    const s = nextState({ savedFlag: true, pillState: 'idle' }, { type: 'mirror-hit-live' })
    expect(s).toEqual({ savedFlag: true, pillState: 'idle' })
  })
})

describe('nextState — mirror-miss (live invalidation)', () => {
  it('clears savedFlag on mirror-miss', () => {
    const s = nextState({ savedFlag: true, pillState: 'idle' }, { type: 'mirror-miss' })
    expect(s).toEqual({ savedFlag: false, pillState: 'idle' })
  })

  it('mirror-miss during hover keeps hover', () => {
    const s = nextState({ savedFlag: true, pillState: 'hover' }, { type: 'mirror-miss' })
    expect(s).toEqual({ savedFlag: false, pillState: 'hover' })
  })

  it('mirror-miss when already unsaved is no-op', () => {
    const s = nextState({ savedFlag: false, pillState: 'idle' }, { type: 'mirror-miss' })
    expect(s).toEqual({ savedFlag: false, pillState: 'idle' })
  })
})

describe('nextState — unknown / malformed events', () => {
  it('returns state unchanged for unknown type', () => {
    const s = nextState({ savedFlag: false, pillState: 'idle' }, { type: 'nope' })
    expect(s).toEqual({ savedFlag: false, pillState: 'idle' })
  })

  it('handles null event safely', () => {
    const s = nextState({ savedFlag: false, pillState: 'idle' }, null)
    expect(s).toEqual({ savedFlag: false, pillState: 'idle' })
  })

  it('handles undefined event safely', () => {
    const s = nextState({ savedFlag: false, pillState: 'idle' }, undefined)
    expect(s).toEqual({ savedFlag: false, pillState: 'idle' })
  })
})

describe('visualState — projection of (savedFlag, pillState)', () => {
  it('saving is always saving regardless of savedFlag', () => {
    expect(visualState({ savedFlag: false, pillState: 'saving' })).toBe('saving')
    expect(visualState({ savedFlag: true, pillState: 'saving' })).toBe('saving')
  })

  it('flash is always flash', () => {
    expect(visualState({ savedFlag: true, pillState: 'flash' })).toBe('flash')
  })

  it('error is always error', () => {
    expect(visualState({ savedFlag: false, pillState: 'error' })).toBe('error')
  })

  it('saved + hover -> saved-hover', () => {
    expect(visualState({ savedFlag: true, pillState: 'hover' })).toBe('saved-hover')
  })

  it('saved + idle -> saved-idle', () => {
    expect(visualState({ savedFlag: true, pillState: 'idle' })).toBe('saved-idle')
  })

  it('unsaved + hover -> idle-hover', () => {
    expect(visualState({ savedFlag: false, pillState: 'hover' })).toBe('idle-hover')
  })

  it('unsaved + idle -> idle', () => {
    expect(visualState({ savedFlag: false, pillState: 'idle' })).toBe('idle')
  })
})

describe('timing constants', () => {
  it('FLASH_MS matches cursor pill saved hide timing', () => {
    expect(FLASH_MS).toBe(1700)
  })

  it('ERROR_MS matches cursor pill error hide timing', () => {
    expect(ERROR_MS).toBe(2400)
  })
})
