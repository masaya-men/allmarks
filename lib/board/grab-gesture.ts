/** What a board pointerdown should engage. */
export type BoardPointerIntent = 'pan' | 'wiggle' | 'ignore'

/** Decide how to handle a board pointerdown. Preserves existing pan triggers
 *  (middle button, left+Space, bare-layer drag) and only re-routes the plain
 *  left button on the bare interaction layer to 'wiggle' when enabled.
 *
 *  @param input.button        PointerEvent.button (0=left, 1=middle, 2=right)
 *  @param input.spaceHeld     whether Space is held (pan modifier)
 *  @param input.isSelfTarget  e.target === e.currentTarget (bare empty area)
 *  @param input.wiggleEnabled whether the grab-wiggle interaction is active
 */
export function classifyBoardPointerDown(input: {
  button: number
  spaceHeld: boolean
  isSelfTarget: boolean
  wiggleEnabled: boolean
}): BoardPointerIntent {
  const { button, spaceHeld, isSelfTarget, wiggleEnabled } = input
  if (button === 1 || (button === 0 && spaceHeld)) return 'pan'
  if (!isSelfTarget) return 'ignore'
  if (button === 0 && wiggleEnabled) return 'wiggle'
  return 'pan'
}
