// Pure state-machine for the AllMarks cursor pill.
// Imported by content.js + tests/extension/cursor-pill.test.ts.
//
// `duplicate` is the "gentle nudge — you already saved this" state.
// Visually distinct from `saved` so the user doesn't think they accidentally
// saved twice: warning-triangle (= ⚠) icon + amber stroke + amber label
// text. The hide is a bit slower (2000ms vs 1700ms) so the user has a
// moment to read it.

export const PILL_STATES = ['saving', 'saved', 'duplicate', 'error']

export function pillStateView(state) {
  if (state === 'saving')    return { label: 'Saving',       icon: 'ring',  autoHideMs: null }
  if (state === 'saved')     return { label: 'Saved',        icon: 'check', autoHideMs: 1700 }
  if (state === 'duplicate') return { label: 'Already saved', icon: 'warn', autoHideMs: 2000 }
  if (state === 'error')     return { label: 'Failed',       icon: 'bang',  autoHideMs: 2400 }
  return null  // unknown state -> caller should ignore
}
