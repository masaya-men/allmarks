// Fixed aspect ratio for PlaceholderCard (= old TextCard's TEXT_CARD_ASPECT).
// A thumbnail-less card resolves to width / 1.25 tall. Kept in its own leaf
// module (no imports) so both the card component and the layout-height helper
// in ./index can share one source of truth without an import cycle.
export const PLACEHOLDER_ASPECT = 1.25
