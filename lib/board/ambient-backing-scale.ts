/** Target backing resolution for Tier 1 ambient (muted, in-view autoplay) video
 *  layers, expressed as device-pixels-per-CSS-pixel. 1.0 = FHD-class crispness
 *  (one physical pixel per CSS pixel, like a non-retina display). On a 4K screen
 *  at high OS scaling the real devicePixelRatio is ~2.58, so capping the ambient
 *  layer at 1.0 cuts each video's rendered pixel area to ~(1/2.58)² ≈ 15%, which
 *  is what keeps a board full of videos smooth on 4K. Lower = lighter + softer
 *  (≈0.75 ≈ 720p-class). Only affects autoplay previews — clicking to watch and
 *  the Lightbox always render at full device resolution. */
export const AMBIENT_TARGET_DPR = 1.0

/** Fraction (0–1] to lay an ambient iframe out at, relative to its display box,
 *  so it rasterizes at ~AMBIENT_TARGET_DPR device pixels per CSS pixel. The
 *  caller scales it back up by 1/fraction (so it still fills the card) — the
 *  iframe's child document then renders fewer pixels. Returns 1 (no downscale)
 *  when the device is already at or below the target, so we never UPSCALE the
 *  render (which would waste work and blur for nothing). */
export function ambientBackingScale(deviceDpr: number, targetDpr: number = AMBIENT_TARGET_DPR): number {
  if (!(deviceDpr > 0) || !(targetDpr > 0)) return 1
  return Math.min(1, targetDpr / deviceDpr)
}
