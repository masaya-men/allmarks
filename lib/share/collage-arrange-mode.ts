import { fitSelectionToScreen, type CollageElement, type CollageFitRect, type CollagePositions, type FitOptions } from './collage-layout'
import { fitSelectionMosaic } from './collage-mosaic'

/** Single switch for which auto-layout ARRANGE seeds with (N-76 trial). Flip
 *  back to 'justified' to fully restore the pre-N-76 behavior — the old
 *  algorithm (fitSelectionToScreen) is untouched, not deleted. */
export const ARRANGE_AUTOLAYOUT: 'justified' | 'mosaic' = 'mosaic'

/** Gap (px) between cells when ARRANGE_AUTOLAYOUT === 'mosaic'. Zero, not a
 *  small gutter like fitSelectionToScreen's rows: the treemap nests cards
 *  into shared columns/rows (squarify), so any positive gap creates small
 *  gaps BETWEEN STACKED cards that can themselves land on the outer edge —
 *  a structural side effect of gaps in a treemap, not just cosmetic. The
 *  actual ask (N-76) was "no dead space", not "a visible grid gap", so
 *  edge-to-edge (0) is both truer to that and avoids the issue entirely. */
const MOSAIC_GAP_PX = 0

/** Seeds the ARRANGE auto-layout using whichever algorithm ARRANGE_AUTOLAYOUT
 *  currently selects. Both call sites in BoardRoot (desktop + mobile) go
 *  through this one function so the switch only needs flipping in one place. */
export function seedArrangeLayout(
  cards: readonly CollageElement[],
  rect: CollageFitRect,
  opts?: FitOptions,
): CollagePositions {
  return ARRANGE_AUTOLAYOUT === 'mosaic'
    ? fitSelectionMosaic(cards, rect, { gap: MOSAIC_GAP_PX })
    : fitSelectionToScreen(cards, rect, opts)
}
