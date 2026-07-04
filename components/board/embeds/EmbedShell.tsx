'use client'

import { type CSSProperties, type ReactNode } from 'react'
import styles from '../Lightbox.module.css'

/** Pre-play poster wrap used by every embed type (YouTube / TikTok /
 *  Instagram). Renders the saved thumbnail at the *board card's persisted
 *  aspect* (via `--item-aspect` CSS var) so the lightbox open animation
 *  ends on a shape identical to the source card — the clone→media swap
 *  becomes visually invisible. Overlay (Play button or external link) is
 *  passed as children so each embed can express its specific affordance.
 *  Falls back to `fallbackAspect` when the item has no persisted aspect
 *  (share-view cards). B-#17-#2. */
export function EmbedPosterBox({
  aspectRatio,
  fallbackAspect,
  thumbnail,
  alt,
  children,
  onError,
}: {
  readonly aspectRatio: number | undefined
  readonly fallbackAspect: number
  readonly thumbnail: string | undefined
  readonly alt: string
  readonly children?: ReactNode
  /** Optional poster load-error handler so an embed (e.g. YouTube) can walk a
   *  thumbnail-quality fallback chain, mirroring the board card. Omitted → no
   *  fallback (the poster is simply blank behind the play affordance). N-23. */
  readonly onError?: () => void
}): ReactNode {
  const aspect = aspectRatio && aspectRatio > 0 ? aspectRatio : fallbackAspect
  return (
    <div
      className={styles.embedPosterBox}
      style={{ '--item-aspect': aspect } as CSSProperties}
    >
      {thumbnail && <img src={thumbnail} alt={alt} className={styles.embedPoster} onError={onError} />}
      {children}
    </div>
  )
}

/** LiquidGlass-styled center play button — the sole pre-play affordance
 *  shared by YouTube and TikTok. Click delegates to the parent embed's
 *  `setHasInteracted(true)` to mount the actual player. */
export function EmbedPlayButton({ onClick }: { readonly onClick: () => void }): ReactNode {
  return (
    <button
      type="button"
      className={styles.playOverlay}
      onClick={onClick}
      aria-label="Play"
    >
      <span className={styles.playDisc} aria-hidden="true">
        <svg viewBox="0 0 24 24" className={styles.playOverlayIcon} aria-hidden="true">
          <path d="M6.5 5v14l11-7z" />
        </svg>
      </span>
    </button>
  )
}
