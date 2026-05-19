// Pure state-machine for the AllMarks cursor pill.
// Imported by content.js + tests/extension/cursor-pill.test.ts.
//
// `duplicate` is the "gentle nudge — you already saved this" state. Same
// success-green check as `saved` (the URL is genuinely safe in AllMarks),
// but the label changes to "Already saved" and the hide is a bit slower
// (2000ms vs 1700ms) so the user has a moment to register that nothing
// new was created.

export const PILL_STATES = ['saving', 'saved', 'duplicate', 'error']

export function pillStateView(state) {
  if (state === 'saving')    return { label: 'Saving',       icon: 'ring',  autoHideMs: null }
  if (state === 'saved')     return { label: 'Saved',        icon: 'check', autoHideMs: 1700 }
  if (state === 'duplicate') return { label: 'Already saved', icon: 'check', autoHideMs: 2000 }
  if (state === 'error')     return { label: 'Failed',       icon: 'bang',  autoHideMs: 2400 }
  return null  // unknown state -> caller should ignore
}
