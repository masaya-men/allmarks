'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type WheelEvent as ReactWheelEvent } from 'react'
import type { BoardItem } from '@/lib/storage/use-board-data'
import type { DisplayMode } from '@/lib/board/types'
import { getFaviconUrl, hostnameFromUrl } from '@/lib/embed/favicon'
import { pickTitleTypography } from '@/lib/embed/title-typography'
import { measureTextCardLayout } from '@/lib/embed/text-card-measure'
import { pickTextCardColor } from '@/lib/embed/text-card-color'
import { cleanTitle } from '@/lib/embed/clean-title'
import styles from './TextCard.module.css'

type Props = {
  readonly item: BoardItem
  readonly cardWidth?: number
  readonly cardHeight?: number
  readonly persistMeasuredAspect?: (cardId: string, aspectRatio: number) => Promise<void>
  readonly reportIntrinsicHeight?: (cardId: string, heightPx: number) => void
  readonly displayMode: DisplayMode
  /** Session 36: Lightbox の `.media` (LargeTextCardScaler) では URL 行を非表示にして
   *  title だけが伸び伸び拡大される (= session 35 で確定した「テキストカードがそのまま拡大」
   *  の核心仕様)。 board の通常描画では omitMeta は付けない。 */
  readonly omitMeta?: boolean
}

/** Two aspect ratios are considered "effectively equal" under this threshold.
 * Prevents write loops when measurement matches the already-cached value. */
const ASPECT_EPSILON = 0.005

export function TextCard({
  item,
  cardWidth = 280,
  cardHeight = 360,
  persistMeasuredAspect,
  reportIntrinsicHeight,
  omitMeta = false,
}: Props): ReactNode {
  const hostname = hostnameFromUrl(item.url)
  const faviconUrl = hostname ? getFaviconUrl(hostname) : null
  const rawTitle = item.title || hostname || item.url
  const title = cleanTitle(rawTitle, item.url)
  const typography = pickTitleTypography({ title, cardWidth, cardHeight })

  const colorVariant = useMemo(() => pickTextCardColor(item.cardId), [item.cardId])

  const layoutResult = measureTextCardLayout({ title, cardWidth, typography })

  const lastMeasuredKeyRef = useRef<string>('')
  useEffect(() => {
    if (!persistMeasuredAspect && !reportIntrinsicHeight) return
    if (!layoutResult) return
    const key = `${cardWidth}:${typography.mode}:${typography.fontSize}:${title}`
    if (lastMeasuredKeyRef.current === key) return
    lastMeasuredKeyRef.current = key
    const aspect = layoutResult.aspectRatio
    if (aspect <= 0) return
    reportIntrinsicHeight?.(item.bookmarkId, cardWidth / aspect)
    if (Math.abs(aspect - item.aspectRatio) < ASPECT_EPSILON) return
    void persistMeasuredAspect?.(item.cardId, aspect)
  }, [item.cardId, item.bookmarkId, item.aspectRatio, title, cardWidth, typography, layoutResult, persistMeasuredAspect, reportIntrinsicHeight])

  // Overflow detection — mask + scroll only kick in when title overflows the
  // card vertically. Short titles render as plain text with no decoration.
  const titleScrollRef = useRef<HTMLDivElement>(null)
  const [hasOverflow, setHasOverflow] = useState<boolean>(false)
  // `atBottom` controls the fade mask — we hide the fade when the user has
  // scrolled to the end so the last line of text is fully legible (without
  // this, the bottom 30% gradient permanently veiled the last line).
  const [atBottom, setAtBottom] = useState<boolean>(false)

  const updateScrollState = useCallback((): void => {
    const el = titleScrollRef.current
    if (!el) return
    const overflow = el.scrollHeight > el.clientHeight + 1
    setHasOverflow(overflow)
    if (!overflow) {
      setAtBottom(false)
      return
    }
    // 2px tolerance — Chromium sub-pixel rounding makes "exactly at bottom"
    // land at scrollTop + clientHeight slightly less than scrollHeight.
    setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 2)
  }, [])

  useEffect(() => {
    updateScrollState()
    const el = titleScrollRef.current
    if (!el) return
    const observer = new ResizeObserver(updateScrollState)
    observer.observe(el)
    return (): void => observer.disconnect()
  }, [title, cardWidth, cardHeight, typography.fontSize, typography.lineHeight, updateScrollState])

  // Wheel scroll-chaining: when the card has room to scroll in the wheel
  // direction, eat the event so the surrounding InteractionLayer (board)
  // and Lightbox window-level handlers don't steal it for board pan / nav.
  // When the card is at its scroll edge, let the wheel bubble normally so
  // board pan / nav still feel responsive.
  const handleCardWheel = useCallback((e: ReactWheelEvent<HTMLDivElement>): void => {
    if (!hasOverflow) return
    const el = titleScrollRef.current
    if (!el) return
    const dy = e.deltaY
    if (dy === 0) return
    const atTop = el.scrollTop <= 0
    const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
    if ((dy > 0 && !atEnd) || (dy < 0 && !atTop)) {
      e.stopPropagation()
    }
  }, [hasOverflow])

  const titleStyle: CSSProperties = {
    fontSize: `${typography.fontSize}px`,
    lineHeight: `${typography.lineHeight}px`,
  }

  return (
    <div className={`${styles.textCard} ${styles[colorVariant]}`}>
      {faviconUrl && !omitMeta && (
        <div className={styles.metaTop}>
          <img src={faviconUrl} alt="" className={styles.favicon} draggable={false} />
          <span className={styles.domain}>{hostname}</span>
        </div>
      )}

      <div
        ref={titleScrollRef}
        className={styles.titleScroll}
        data-overflow={hasOverflow ? 'true' : 'false'}
        data-at-bottom={atBottom ? 'true' : 'false'}
        data-card-scroll="true"
        onScroll={updateScrollState}
        onWheel={handleCardWheel}
      >
        <div className={styles.titleInner} style={titleStyle}>
          {title}
        </div>
      </div>
    </div>
  )
}
