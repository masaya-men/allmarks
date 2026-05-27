'use client'

import { useCallback, useEffect, useRef, useState, type MutableRefObject, type ReactElement, type RefObject } from 'react'
import { BOARD_INNER, BOARD_TOP_PAD_PX, CANVAS_MARGIN_PX } from '@/lib/board/constants'
import { pickPlaceholderImage } from '@/lib/board/placeholder-image'
import styles from './ShareMirror.module.css'

export type MirrorItem = {
  readonly id: string         // = bookmarkId, for position lookup
  readonly url: string        // = for data-mirror-card-id (capture lookup)
  readonly title: string
  readonly thumbnailUrl: string | null
}

export type MirrorPosition = {
  readonly id: string  // bookmarkId
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

type Props = {
  /** Board items to render in the mirror (= filteredItems mapped). */
  readonly items: ReadonlyArray<MirrorItem>
  /** Layout positions from bg board's skyline layout. */
  readonly positions: ReadonlyArray<MirrorPosition>
  /** Bg board's card-area width = effectiveLayoutWidth = viewport.w - 2 * SIDE_PADDING_PX.
   *  Used as the cards layer width (= where cards live). */
  readonly bgViewportWidth: number
  /** Bg board's canvas INNER width = viewport.w = the dark canvas inside outerFrame.
   *  Used (with viewportHeight) to size the canvas-replica + compute scale. */
  readonly bgCanvasWidth: number
  /** Active filter tag names for top brand strip. Empty = no strip. */
  readonly activeTagNames: ReadonlyArray<string>
  /** Total cards in the full board view (= for "N OF M" display). */
  readonly totalBoardCount: number
  /** Number of cards being shared (= getShareData().cards.length). */
  readonly sharedCardCount: number
  /** Current bg-board scrollY (= bg board coords). 0 = top. */
  readonly scrollY: number
  /** Bg board's full scrollable height. Used as cardsLayer minimum height. */
  readonly contentHeight: number
  /** Bg board's viewport height = canvas inner height. Used for canvas-replica height. */
  readonly viewportHeight: number
  /** Forwarded ref to the frame DOM so capture-mirror.ts can read rects. Optional. */
  readonly frameRef?: RefObject<HTMLDivElement | null>
}

export function ShareMirror({
  items,
  positions,
  bgViewportWidth,
  bgCanvasWidth,
  activeTagNames,
  totalBoardCount,
  sharedCardCount,
  scrollY,
  contentHeight,
  viewportHeight,
  frameRef,
}: Props): ReactElement {
  // The bg-replica reproduces bg's full screen chrome:
  //   outerFrame (48px padding) → canvas (viewport.w × viewport.h) →
  //   cards wrapper (translate +9, +80 - scrollY) → cards at world (x, y).
  // We scale that whole replica to fit the mirror frame width so the OG image
  // looks like a mini-bg. Scale = mirror_frame_css_width / bg full screen width.
  // Default 0.4 is a reasonable first-paint guess before ResizeObserver fires.
  const [scale, setScale] = useState<number>(0.4)
  const internalFrameRef = useRef<HTMLDivElement | null>(null)

  const setFrameRef = useCallback((el: HTMLDivElement | null): void => {
    internalFrameRef.current = el
    if (frameRef) {
      (frameRef as MutableRefObject<HTMLDivElement | null>).current = el
    }
  }, [frameRef])

  const bgFullScreenWidth = bgCanvasWidth + 2 * CANVAS_MARGIN_PX
  const bgFullScreenHeight = viewportHeight + 2 * CANVAS_MARGIN_PX

  useEffect((): (() => void) => {
    const el = internalFrameRef.current
    if (!el) return (): void => undefined
    const observer = new ResizeObserver((entries): void => {
      const entry = entries[0]
      if (entry) {
        const cssWidth = entry.contentRect.width
        if (cssWidth > 0 && bgFullScreenWidth > 0) {
          setScale(cssWidth / bgFullScreenWidth)
        }
      }
    })
    observer.observe(el)
    return (): void => observer.disconnect()
  }, [bgFullScreenWidth])

  const N = sharedCardCount
  const M = totalBoardCount
  const captionText = M > N ? `${N} OF ${M} CARDS · NEWEST FIRST` : `${N} CARDS`
  const tagText = activeTagNames.map((s): string => s.toUpperCase()).join(' · ')

  return (
    <div className={styles.frame} ref={setFrameRef} data-testid="mirror-frame">
      {/* Bg replica: outerFrame band + canvas + cards, scaled to fit frame width.
          Anchored top-left so vertical overflow is clipped at the bottom. */}
      <div
        className={styles.outerBand}
        data-testid="mirror-outer-band"
        style={{
          transformOrigin: '0 0',
          transform: `scale(${scale})`,
          width: bgFullScreenWidth,
          height: bgFullScreenHeight,
        }}
      >
        <div className={styles.canvasReplica}>
          <div
            className={styles.cardsLayer}
            data-testid="mirror-cards-layer"
            style={{
              transform: `translate(${BOARD_INNER.SIDE_PADDING_PX}px, ${BOARD_TOP_PAD_PX - scrollY}px)`,
              width: bgViewportWidth,
              height: Math.max(contentHeight, viewportHeight),
            }}
          >
            {items.map((item): ReactElement | null => {
              const pos = positions.find((p) => p.id === item.id)
              if (!pos) return null
              return (
                <div
                  key={item.url}
                  className={styles.card}
                  data-mirror-card-id={item.url}
                  style={{ left: pos.x, top: pos.y, width: pos.w, height: pos.h }}
                >
                  <MirrorCardContent item={item} />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Brand strips overlay the bg-replica at frame edges (= they appear at
          the OG image edges, regardless of bg-replica scaling). */}
      {activeTagNames.length > 0 ? (
        <div className={styles.tagStrip} data-testid="mirror-tag-strip">{tagText}</div>
      ) : null}

      <div className={styles.bottomStrip}>
        <span className={styles.wordmark}>ALLMARKS</span>
        <span className={styles.caption}>
          <span className={styles.captionDot} aria-hidden="true" />
          {captionText}
        </span>
      </div>
    </div>
  )
}

/** Card content: picks img path vs placeholder path per-card. img path falls
 *  back to a placeholder bg + centered title if the image fails to load
 *  (= CORS-blocked Twitter thumbnails are the dominant real-world case —
 *  pbs.twimg.com does not respond with Access-Control-Allow-Origin so
 *  `crossOrigin="anonymous"` requests fail to display). Placeholder = one of
 *  the abstract images in public/placeholders/ picked deterministically by
 *  URL hash, with the card's title centred over a dark scrim that fades at
 *  the bottom edge so long tweet bodies trail off gracefully. */
function MirrorCardContent({ item }: { readonly item: MirrorItem }): ReactElement {
  const [imgFailed, setImgFailed] = useState<boolean>(false)
  const showPlaceholder = !item.thumbnailUrl || imgFailed
  if (showPlaceholder) {
    const placeholderUrl = pickPlaceholderImage(item.url)
    return (
      <div
        className={styles.cardPlaceholder}
        style={placeholderUrl ? { backgroundImage: `url(${placeholderUrl})` } : undefined}
      >
        <div className={styles.cardPlaceholderScrim} aria-hidden="true" />
        <div className={styles.cardPlaceholderTitle}>{item.title}</div>
      </div>
    )
  }
  return (
    <>
      <img
        src={item.thumbnailUrl ?? ''}
        alt=""
        className={styles.cardThumb}
        crossOrigin="anonymous"
        loading="eager"
        draggable={false}
        onError={(): void => setImgFailed(true)}
      />
      <div className={styles.cardTitle}>{item.title}</div>
    </>
  )
}
