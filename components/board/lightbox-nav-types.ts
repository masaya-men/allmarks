/** Prev/next navigation contract for the lightbox. The caller (BoardRoot or
 *  SharedView) owns the index + loop logic; the lightbox forwards gestures.
 *  Extracted here so both the desktop Lightbox and the MobileLightbox share
 *  one type (session 180). */
export type LightboxNav = {
  readonly currentIndex: number
  readonly total: number
  readonly onNav: (dir: -1 | 1) => void
  readonly onJump: (index: number) => void
}
