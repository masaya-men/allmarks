/** The scroll meter is meaningful only when the board (or select-stage grid) can
 *  scroll. It is hidden during onboarding (the tutorial owns the screen bottom)
 *  and during the arrange stage, where the collage is a fixed, non-scrollable
 *  layout AND the meter (z:400) would otherwise overlap the ShareToast (z:116). */
export function shouldShowScrollMeter(
  showOnboarding: boolean,
  sharePhase: 'select' | 'arrange' | null,
): boolean {
  return !showOnboarding && sharePhase !== 'arrange'
}
