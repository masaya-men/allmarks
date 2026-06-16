// extension/lib/tag-strip-model.js
// Pure helpers for the quick-tag strip. Source of truth for tests; the DOM
// render code is inlined into content.js + floating-button.js (MV3 content
// scripts can't `import`). ⚠ Keep the inline copies in sync with this file.

export const STRIP_MAX_CHIPS = 5

/** First N tags become visible chips; the rest go behind the ALL expander. */
export function splitChips(tags, max = STRIP_MAX_CHIPS) {
  const list = Array.isArray(tags) ? tags : []
  const visible = list.slice(0, max)
  const overflow = list.slice(max)
  return { visible, overflow, hasOverflow: overflow.length > 0 }
}

/** The strip only appears once a save succeeded and the user has tags. */
export function shouldShowStrip(state, tags) {
  if (state !== 'saved' && state !== 'duplicate') return false
  return Array.isArray(tags) && tags.length > 0
}
