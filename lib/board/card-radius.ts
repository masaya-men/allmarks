// lib/board/card-radius.ts
// Single source of truth for a card's size-aware corner radius (the CSS
// --card-radius value). Shared by the board (CardsLayer) and the share collage
// (CollageCanvas) so the two can never drift — previously the formula was
// copy-pasted into both and the collage copy silently dropped the
// roundedCorners=false branch, leaving square-corner boards with rounded
// collage cards (s174 user report).

export interface CardCornerRadiusInput {
  /** The card's rendered width in px. */
  readonly width: number
  /** Board CORNERS toggle. false → square (0). */
  readonly roundedCorners: boolean
  /** Light/paper themes keep a small flat print corner instead of the
   *  size-aware radius. */
  readonly flat: boolean
}

/**
 * Returns the px string for `--card-radius`.
 * - roundedCorners=false → '0px' (square)
 * - flat (light/paper) → '3px'
 * - otherwise size-aware: min(20, width*0.12) so small cards keep a natural
 *   corner and never round into a circle; large cards cap at 20px.
 */
export function cardCornerRadiusPx(input: CardCornerRadiusInput): string {
  if (!input.roundedCorners) return '0px'
  if (input.flat) return '3px'
  return `${Math.min(20, input.width * 0.12).toFixed(1)}px`
}
