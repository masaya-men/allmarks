/** What a board pointerdown should engage. */
export type BoardPointerIntent = 'pan' | 'wiggle' | 'marquee' | 'ignore'

/** Decide how to handle a board pointerdown. Preserves existing pan triggers
 *  (middle button, left+Space, bare-layer drag) and only re-routes the plain
 *  left button on the bare interaction layer to 'wiggle' when enabled, or to
 *  'marquee' (rubber-band multi-select) when TAG MODE is active -- marquee
 *  takes priority over wiggle so entering TAG MODE replaces the background
 *  grab-wiggle with rectangle-select (s219 user decision: a plain drag on
 *  empty space should select cards, not nudge the board, while tagging).
 *
 *  @param input.button          PointerEvent.button (0=left, 1=middle, 2=right)
 *  @param input.spaceHeld       whether Space is held (pan modifier)
 *  @param input.isSelfTarget    e.target === e.currentTarget (bare empty area)
 *  @param input.wiggleEnabled   whether the grab-wiggle interaction is active
 *  @param input.marqueeEnabled  whether rubber-band select is active (TAG MODE)
 */
export function classifyBoardPointerDown(input: {
  button: number
  spaceHeld: boolean
  isSelfTarget: boolean
  wiggleEnabled: boolean
  marqueeEnabled?: boolean
}): BoardPointerIntent {
  const { button, spaceHeld, isSelfTarget, wiggleEnabled, marqueeEnabled = false } = input
  if (button === 1 || (button === 0 && spaceHeld)) return 'pan'
  if (!isSelfTarget) return 'ignore'
  if (button === 0 && marqueeEnabled) return 'marquee'
  if (button === 0 && wiggleEnabled) return 'wiggle'
  return 'pan'
}
