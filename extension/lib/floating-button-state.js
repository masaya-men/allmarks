// Pure state-machine for the floating save button.
// Imported by floating-button.js (inlined for MV3) + tests/extension/floating-button-state.test.ts.
//
// Two orthogonal axes are tracked:
//   - savedFlag: did this URL get saved (now or in a past visit)
//   - pillState: the transient interaction state (idle / hover / saving / flash / error)
// `visualState` projects both into a single CSS data-state value.

export const FLASH_MS = 1700  // matches cursor pill's `saved` autoHideMs
export const ERROR_MS = 2400  // matches cursor pill's `error` autoHideMs

export function initialState() {
  return { savedFlag: false, pillState: 'idle' }
}

export function nextState(state, event) {
  switch (event && event.type) {
    case 'mouseenter':
      if (state.pillState === 'idle') return { ...state, pillState: 'hover' }
      return state
    case 'mouseleave':
      if (state.pillState === 'hover') return { ...state, pillState: 'idle' }
      return state
    case 'click':
      if (state.pillState === 'saving' || state.pillState === 'flash') return state
      return { ...state, pillState: 'saving' }
    case 'save-success':
      if (state.pillState === 'saving') return { savedFlag: true, pillState: 'flash' }
      return state
    case 'save-error':
      if (state.pillState === 'saving') return { ...state, pillState: 'error' }
      return state
    case 'flash-elapsed':
      if (state.pillState === 'flash') return { ...state, pillState: 'idle' }
      return state
    case 'error-elapsed':
      if (state.pillState === 'error') return { ...state, pillState: 'idle' }
      return state
    case 'mirror-hit-initial':
      // Page load: the URL was already in the mirror from a past visit.
      // Light up the saved indicator silently — no flash animation, since
      // the user did not just trigger anything.
      return { ...state, savedFlag: true }
    case 'mirror-hit-live':
      // Live update: the URL appeared in the mirror because the user just
      // saved this page via some non-click path (= site .js auto-save,
      // keyboard shortcut, context menu, bookmarklet). Run the flash
      // animation so the user gets the same visual confirmation as a
      // floating-button click would have given them. Without this the
      // green check would just appear suddenly at the idle opacity (= 30%),
      // which user feedback in session 58 called out as "30% 不可視で
      // 緑チェックされる" — disorienting because there is no transition.
      if (state.savedFlag) return state
      return { ...state, savedFlag: true, pillState: 'flash' }
    case 'mirror-miss':
      // Live update: the user deleted this bookmark in AllMarks, so the
      // mirror entry is gone. Drop the saved indicator (= green check).
      if (!state.savedFlag) return state
      return { ...state, savedFlag: false }
    default:
      return state
  }
}

// Project (savedFlag, pillState) into a single visual state used by CSS [data-state].
export function visualState(state) {
  if (state.pillState === 'saving') return 'saving'
  if (state.pillState === 'flash') return 'flash'
  if (state.pillState === 'error') return 'error'
  if (state.savedFlag && state.pillState === 'hover') return 'saved-hover'
  if (state.savedFlag) return 'saved-idle'
  if (state.pillState === 'hover') return 'idle-hover'
  return 'idle'
}
