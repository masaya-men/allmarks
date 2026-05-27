'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactElement, type RefObject } from 'react'
import type { ShareDataV2, ShareCardV2 } from '@/lib/share/types-v2'
import styles from './ShareMirror.module.css'

const MIRROR_FRAME_WIDTH = 1200    // logical OG width
const MIRROR_FRAME_HEIGHT = 628    // 1200 / 1.91 ~= 628.27, floored to even
const MIRROR_GAP = 6               // gap between cards in mirror coords
const MIRROR_CARD_WIDTH = 80       // typical mirror card width in mirror coords

type Props = {
  readonly shareData: ShareDataV2
  /** Active filter tag names for top brand strip (= "MUSIC · DESIGN"). Empty = no strip. */
  readonly activeTagNames: ReadonlyArray<string>
  /** Total cards in the full board view (= for "N OF M" display). */
  readonly totalBoardCount: number
  /** Current bg-board scrollY (= bg board coords). 0 = top. */
  readonly scrollY: number
  /** Bg board's full scrollable height (= contentBounds.height). Used to compute progress. */
  readonly contentHeight: number
  /** Bg board's viewport height (= viewport.h). */
  readonly viewportHeight: number
  /** Forwarded ref to the frame DOM so capture-mirror.ts can read rects. Optional. */
  readonly frameRef?: RefObject<HTMLDivElement | null>
}

type MirrorCardLayout = {
  readonly card: ShareCardV2
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** Compute simple column-stack layout for mirror. Same skyline philosophy
 *  as bg board, but bounded to MIRROR_FRAME_WIDTH with smaller card widths.
 *
 *  Returns positions + total world height. The mirror viewport scrolls
 *  within this world via bg-board-proportional scrollY. */
function layoutMirrorCards(
  cards: ReadonlyArray<ShareCardV2>,
  frameWidth: number,
  cardWidth: number,
  gap: number,
): { positions: ReadonlyArray<MirrorCardLayout>; worldHeight: number } {
  const cols = Math.max(1, Math.floor((frameWidth + gap) / (cardWidth + gap)))
  const colHeights = new Array<number>(cols).fill(0)
  const positions: MirrorCardLayout[] = []

  for (const card of cards) {
    const cardHeight = cardWidth / Math.max(0.5, card.a)
    let minCol = 0
    for (let c = 1; c < cols; c++) {
      if (colHeights[c] < colHeights[minCol]) minCol = c
    }
    const x = minCol * (cardWidth + gap)
    const y = colHeights[minCol]
    positions.push({ card, x, y, w: cardWidth, h: cardHeight })
    colHeights[minCol] = y + cardHeight + gap
  }

  const worldHeight = Math.max(...colHeights, MIRROR_FRAME_HEIGHT)
  return { positions, worldHeight }
}

export function ShareMirror({
  shareData,
  activeTagNames,
  totalBoardCount,
  scrollY,
  contentHeight,
  viewportHeight,
  frameRef,
}: Props): ReactElement {
  const { positions, worldHeight } = useMemo(
    () => layoutMirrorCards(shareData.cards, MIRROR_FRAME_WIDTH, MIRROR_CARD_WIDTH, MIRROR_GAP),
    [shareData.cards],
  )

  // Scale: cardsLayer is laid out at MIRROR_FRAME_WIDTH (1200 logical px).
  // The CSS frame renders at a smaller CSS px width. We measure the frame's
  // actual CSS width via ResizeObserver and apply scale = cssWidth / 1200.
  // Default 0.6 = 720 / 1200 so first paint isn't completely clipped.
  const [scale, setScale] = useState<number>(720 / MIRROR_FRAME_WIDTH)
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
        if (cssWidth > 0) {
          setScale(cssWidth / MIRROR_FRAME_WIDTH)
        }
      }
    })
    observer.observe(el)
    return (): void => observer.disconnect()
  }, [])

  // Proportional scroll: bg progress 0..1 maps to mirror progress 0..1.
  // Both sides are in mirror coords (MIRROR_FRAME_HEIGHT = 628).
  const bgScrollMax = Math.max(1, contentHeight - viewportHeight)
  const progress = Math.max(0, Math.min(1, scrollY / bgScrollMax))
  const mirrorScrollMax = Math.max(0, worldHeight - MIRROR_FRAME_HEIGHT)
  const mirrorScrollY = progress * mirrorScrollMax

  const N = shareData.cards.length
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
          transform: `scale(${scale}) translateY(${-mirrorScrollY}px)`,
        }}
      >
        {positions.map((p): ReactElement => (
          <div
            key={p.card.u}
            className={styles.card}
            data-mirror-card-id={p.card.u}
            style={{ left: p.x, top: p.y, width: p.w, height: p.h }}
          >
            {p.card.th ? (
              <img
                src={p.card.th}
                alt=""
                className={styles.cardThumb}
                crossOrigin="anonymous"
                loading="eager"
                draggable={false}
              />
            ) : null}
            <div className={styles.cardTitle}>{p.card.t}</div>
          </div>
        ))}
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
