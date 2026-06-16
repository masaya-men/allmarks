'use client'

import {
  useCallback,
  useState,
  type CSSProperties,
  type ReactElement,
  type SyntheticEvent,
} from 'react'
import styles from './PipCard.module.css'

export interface PipCardProps {
  readonly id: string
  readonly thumbnail: string
  readonly favicon: string
  readonly title: string
  /** Width / height ratio of the source content. Optional — when omitted,
   *  PipCard auto-detects it from the loaded image's natural dimensions.
   *  When aspect < 1 (vertical reel), the inner thumbnail expands taller
   *  than the carousel frame so verticals read as actually vertical. */
  readonly aspectRatio?: number
  /** True for the centred/active carousel card — only it shows the + TAG affordance. */
  readonly isActive?: boolean
  /** Whole-feature toggle. When false, no + TAG button is rendered. */
  readonly tagEnabled?: boolean
  /** Ask the PiP window to open the tag menu for this card. The menu itself
   *  is rendered at the PipCompanion window level (as an overlay) so it isn't
   *  clipped by the carousel's overflow. When omitted, no + TAG button shows. */
  readonly onOpenTags?: () => void
}

export function PipCard({
  id,
  thumbnail,
  favicon,
  title,
  aspectRatio,
  isActive,
  tagEnabled,
  onOpenTags,
}: PipCardProps): ReactElement {
  const [imgErrored, setImgErrored] = useState(false)
  const [detectedAspect, setDetectedAspect] = useState<number | undefined>()

  const canTag =
    isActive === true &&
    tagEnabled !== false &&
    onOpenTags !== undefined

  const handleLoad = useCallback((e: SyntheticEvent<HTMLImageElement>): void => {
    if (aspectRatio !== undefined) return
    const img = e.currentTarget
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setDetectedAspect(img.naturalWidth / img.naturalHeight)
    }
  }, [aspectRatio])

  const showThumbnail = thumbnail !== '' && !imgErrored
  const showFavicon = !showThumbnail && favicon !== ''
  const showGeneric = !showThumbnail && !showFavicon

  const effectiveAspect = aspectRatio ?? detectedAspect

  // Hand the per-card aspect to PipCard.module.css; the outer .card sizes
  // itself via min/calc so each card lands at its native shape. Vertical
  // content stays narrow + tall, landscape stays wide + short — the
  // carousel's row spacing varies with it, accepted as the cost of
  // honouring real aspect ratios over uniform card slots.
  const styleVar: CSSProperties | undefined = effectiveAspect !== undefined
    ? ({ '--pip-card-aspect': effectiveAspect } as CSSProperties)
    : undefined

  return (
    <div
      className={styles.card}
      data-testid={`pip-card-${id}`}
      data-card-id={id}
      aria-label={title}
      style={styleVar}
    >
      <div className={styles.cardInner}>
        {showThumbnail && (
          <img
            className={styles.thumbnail}
            src={thumbnail}
            alt=""
            data-role="thumbnail"
            aria-hidden="true"
            onLoad={handleLoad}
            onError={() => setImgErrored(true)}
          />
        )}
        {showFavicon && (
          <div className={styles.faviconFallback}>
            <img src={favicon} alt="" data-role="favicon-fallback" aria-hidden="true" />
          </div>
        )}
        {showGeneric && (
          <div className={styles.genericPlaceholder} data-role="generic-placeholder" aria-hidden="true" />
        )}
      </div>
      {canTag && (
        <div className={styles.tagAffordance}>
          <button
            type="button"
            data-testid="pip-add-tag-button"
            aria-label="Add tag"
            className={styles.addTagButton}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onOpenTags?.()
            }}
          >
            + TAG
          </button>
        </div>
      )}
    </div>
  )
}
