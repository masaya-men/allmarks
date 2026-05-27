'use client'

import { useCallback, useEffect, useRef, useState, type MutableRefObject, type ReactElement, type RefObject } from 'react'
import styles from './ShareMirror.module.css'

const MIRROR_FRAME_WIDTH = 1200    // logical OG width
const MIRROR_FRAME_HEIGHT = 628    // 1200 / 1.91 ~= 628.27, floored to even

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
  /** Layout positions from bg board's skyline layout (= Record converted to Array). */
  readonly positions: ReadonlyArray<MirrorPosition>
  /** Bg board's CSS viewport width. Used to compute scale = mirrorCssWidth / bgViewportWidth. */
  readonly bgViewportWidth: number
  /** Active filter tag names for top brand strip (= "MUSIC · DESIGN"). Empty = no strip. */
  readonly activeTagNames: ReadonlyArray<string>
  /** Total cards in the full board view (= for "N OF M" display). */
  readonly totalBoardCount: number
  /** Number of cards being shared (= getShareData().cards.length). */
  readonly sharedCardCount: number
  /** Current bg-board scrollY (= bg board coords). 0 = top. */
  readonly scrollY: number
  /** Bg board's full scrollable height (= contentBounds.height). Used to compute progress. */
  readonly contentHeight: number
  /** Bg board's viewport height (= viewport.h). */
  readonly viewportHeight: number
  /** Forwarded ref to the frame DOM so capture-mirror.ts can read rects. Optional. */
  readonly frameRef?: RefObject<HTMLDivElement | null>
}

export function ShareMirror({
  items,
  positions,
  bgViewportWidth,
  activeTagNames,
  totalBoardCount,
  sharedCardCount,
  scrollY,
  contentHeight,
  viewportHeight,
  frameRef,
}: Props): ReactElement {
  // Scale: cardsLayer is laid out at bg board coords (bgViewportWidth logical px).
  // The CSS frame renders at a smaller CSS px width. We measure the frame's
  // actual CSS width via ResizeObserver and apply scale = cssWidth / bgViewportWidth.
  // Default 0.5 = reasonable first-paint guess before measurement.
  const [scale, setScale] = useState<number>(0.5)
  const internalFrameRef = useRef<HTMLDivElement | null>(null)

  const setFrameRef = useCallback((el: HTMLDivElement | null): void => {
    internalFrameRef.current = el
    if (frameRef) {
      (frameRef as MutableRefObject<HTMLDivElement | null>).current = el
    }
  }, [frameRef])

  useEffect((): (() => void) => {
    const el = internalFrameRef.current
    if (!el) return (): void => undefined
    const observer = new ResizeObserver((entries): void => {
      const entry = entries[0]
      if (entry) {
        const cssWidth = entry.contentRect.width
        if (cssWidth > 0 && bgViewportWidth > 0) {
          setScale(cssWidth / bgViewportWidth)
        }
      }
    })
    observer.observe(el)
    return (): void => observer.disconnect()
  }, [bgViewportWidth])

  // Scroll sync: the mirror's cardsLayer translates by -scrollY in bg board coords.
  // CSS transform order: scale(s) translateY(-scrollY) means translateY is in
  // pre-scale (bg board) coords. After scaling, visual offset = -scrollY * scale.
  // This matches the bg board exactly: same card positions, just scaled down.
  const frameHeight = MIRROR_FRAME_HEIGHT

  const N = sharedCardCount
  const M = totalBoardCount
  const captionText = M > N ? `${N} OF ${M} CARDS · NEWEST FIRST` : `${N} CARDS`
  const tagText = activeTagNames.map((s): string => s.toUpperCase()).join(' · ')

  return (
    <div className={styles.frame} ref={setFrameRef} data-testid="mirror-frame">
      {activeTagNames.length > 0 ? (
        <div className={styles.tagStrip} data-testid="mirror-tag-strip">{tagText}</div>
      ) : null}

      <div
        className={styles.cardsLayer}
        data-testid="mirror-cards-layer"
        style={{
          transformOrigin: '0 0',
          // scale(s) translateY(-scrollY): translateY is in bg board coords.
          // After scale, visual translate = -scrollY * scale CSS px.
          transform: `scale(${scale}) translateY(${-scrollY}px)`,
          width: bgViewportWidth,
          height: Math.max(contentHeight, frameHeight / scale),
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
              {item.thumbnailUrl ? (
                <img
                  src={item.thumbnailUrl}
                  alt=""
                  className={styles.cardThumb}
                  crossOrigin="anonymous"
                  loading="eager"
                  draggable={false}
                />
              ) : null}
              <div className={styles.cardTitle}>{item.title}</div>
            </div>
          )
        })}
      </div>

      <div className={styles.bottomStrip}>
        <svg className={styles.brandLogo} viewBox="0 0 32 32" aria-hidden="true">
          <path d="M5.76 26.88L16 3.2l10.24 23.68" stroke="rgba(255,255,255,0.94)" strokeWidth="2.56" fill="none" strokeLinecap="square"/>
          <path d="M10.56 18.56h10.88" stroke="rgba(255,255,255,0.94)" strokeWidth="2.56" fill="none" strokeLinecap="square"/>
          <path d="M19.84 23.68l3.2 3.2 5.76-7.04" stroke="#28F100" strokeWidth="1.92" fill="none" strokeLinecap="square" strokeLinejoin="miter"/>
        </svg>
        <span className={styles.caption}>
          <span className={styles.captionDot} aria-hidden="true" />
          {captionText}
        </span>
      </div>
    </div>
  )
}
