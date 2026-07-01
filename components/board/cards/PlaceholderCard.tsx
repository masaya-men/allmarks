'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type WheelEvent as ReactWheelEvent } from 'react'
import type { BoardItem } from '@/lib/storage/use-board-data'
import type { DisplayMode } from '@/lib/board/types'
import { hostnameFromUrl } from '@/lib/embed/favicon'
import { pickTitleTypography } from '@/lib/embed/title-typography'
import { cleanTitle } from '@/lib/embed/clean-title'
import { placeholderArtFrames } from '@/lib/board/placeholder-image'
import { useSlideshowCycle } from '@/lib/board/use-slideshow-cycle'
import { paperAssetUrl, pickTextNoteSheet } from '@/lib/board/paper-assets'
import { PLACEHOLDER_ASPECT } from './placeholder-aspect'
import styles from './PlaceholderCard.module.css'

type Props = {
  readonly item: BoardItem
  readonly cardWidth?: number
  readonly cardHeight?: number
  readonly persistMeasuredAspect?: (cardId: string, aspectRatio: number) => Promise<void>
  readonly reportIntrinsicHeight?: (cardId: string, heightPx: number) => void
  readonly displayMode?: DisplayMode
  /** Lightbox の LargeTextCardScaler 等、 拡大表示で hostname strip を抑制する用途。
   *  board の通常描画では付けない。 既存 TextCard の `omitMeta` と同じ意味論。 */
  readonly omitMeta?: boolean
  /** Board ambient gate (= CardsLayer の `ambientOn`: motion on / not in lightbox
   *  / not scrolling / reduce-motion off)。 true かつ「画面内」のときだけ、 生成
   *  アートを複数フレーム巡回 (= 複数画像ツイート式) する。 Lightbox / ImageCard
   *  fallback は渡さない → 常に frame[0] 静止 (= B1 と同一の見た目)。 */
  readonly ambientOn?: boolean
  /** paper-atelier theme: render the thumbnail-less card as a graph / notepad
   *  paper sheet with the title hand-written on it (parity with ImageCard's
   *  paper face). Only CardsLayer sets this; Lightbox / triage leave it false
   *  so they keep the generated-art placeholder. */
  readonly paper?: boolean
}

const ASPECT_EPSILON = 0.005

/** 文字無し / 画像無し / 取得失敗の全カードを「placeholder bg + 中央タイトル」 で
 *  統一する component。 旧 TextCard / MinimalCard / ImageCard onError fallback の
 *  置き換え。 設計:
 *
 *  - bg は public/placeholders/ の AI 4 枚から URL ハッシュで決定論的選択
 *  - 中央に title (= cleanTitle で boilerplate 除去済) を上下 fade マスク付きで
 *    スクロール表示。 font-size は pickTitleTypography で決定 (= 旧 TextCard と
 *    同じロジックなので Lightbox の cloneNode + scale 拡大時に font jump しない)
 *  - 左上に小さいホスト名 strip (= favicon 無し、 monospace 10px、 半透明白)
 *  - Lightbox の `LargeBoardCardClone` は board の DOM を cloneNode してくるので、
 *    bg / scrim / title が一括で拡大される (= board と Lightbox で見た目が一貫)
 */
export function PlaceholderCard({
  item,
  cardWidth = 280,
  cardHeight = 360,
  persistMeasuredAspect,
  reportIntrinsicHeight,
  omitMeta = false,
  ambientOn = false,
  paper = false,
}: Props): ReactNode {
  const hostname = hostnameFromUrl(item.url)
  const rawTitle = item.title || hostname || item.url
  const title = cleanTitle(rawTitle, item.url)
  const typography = pickTitleTypography({ title, cardWidth, cardHeight })

  // 生成アートの巡回 (= 複数画像ツイート式)。frames[0] は pickPlaceholderImage と一致
  // するので、 巡回しないとき (= ambientOn false / 画面外 / 単一フレーム) は B1 の
  // 静止表示と寸分同じ見た目になる。
  const rootRef = useRef<HTMLDivElement>(null)
  const frames = useMemo(() => placeholderArtFrames(item.url), [item.url])

  // 画面内かどうかは自前の IntersectionObserver で検知する。 observer は
  // ambientOn (= board で motion on) のときだけ生成し、 motion off / Lightbox /
  // triage / PiP では一切作らない (= 大量カードでも observer を増やさない)。
  const [inView, setInView] = useState<boolean>(false)
  useEffect((): (() => void) | void => {
    if (!ambientOn) {
      setInView(false)
      return
    }
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries): void => setInView(entries.some((e) => e.isIntersecting)),
      { threshold: 0.15 },
    )
    io.observe(el)
    return (): void => io.disconnect()
  }, [ambientOn])

  // frameCount < 2 を渡すと hook は常に 0 (静止・timer 無し)。 巡回条件を満たす
  // ときだけ frames.length を渡して循環させる = MOTIONオフ/スクロール/省モーション/
  // Lightbox/画面外 で自動停止 (ambientOn と inView に集約済み)。
  const cycleEnabled = ambientOn && inView && frames.length >= 2
  const activeFrame = useSlideshowCycle(cycleEnabled ? frames.length : 1)

  // motion off 等で巡回しないときは frame[0] 1 枚だけ描く (= DOM を太らせない)。
  // motion on のときは全フレームを stack して inView の切り替えで巡回開始しても
  // re-mount しない (= ちらつき無し)。
  const layerUrls = ambientOn ? frames : frames.slice(0, 1)

  // Report intrinsic height so layout doesn't reflow with text overflow.
  // Aspect is fixed (PLACEHOLDER_ASPECT, shared with the layout-height helper)
  // so a 280px wide card resolves to 224px tall — matches user's recent sizing.
  // The board layout now computes this height eagerly (itemSkylineHeight), so
  // this report only refines the ImageCard error-fallback case.
  const lastReportedKeyRef = useRef<string>('')
  useEffect((): void => {
    if (!persistMeasuredAspect && !reportIntrinsicHeight) return
    const key = `${cardWidth}:${PLACEHOLDER_ASPECT}`
    if (lastReportedKeyRef.current === key) return
    lastReportedKeyRef.current = key
    reportIntrinsicHeight?.(item.bookmarkId, cardWidth / PLACEHOLDER_ASPECT)
    if (Math.abs(PLACEHOLDER_ASPECT - item.aspectRatio) < ASPECT_EPSILON) return
    void persistMeasuredAspect?.(item.cardId, PLACEHOLDER_ASPECT)
  }, [item.cardId, item.bookmarkId, item.aspectRatio, cardWidth, persistMeasuredAspect, reportIntrinsicHeight])

  const titleScrollRef = useRef<HTMLDivElement>(null)
  const [hasOverflow, setHasOverflow] = useState<boolean>(false)
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
    setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 2)
  }, [])

  useEffect((): (() => void) => {
    updateScrollState()
    const el = titleScrollRef.current
    if (!el) return (): void => undefined
    const observer = new ResizeObserver(updateScrollState)
    observer.observe(el)
    return (): void => observer.disconnect()
  }, [title, cardWidth, cardHeight, typography.fontSize, typography.lineHeight, updateScrollState])

  // Wheel scroll-chaining: when the title body has room to scroll, eat the
  // wheel event so InteractionLayer / Lightbox don't steal it for pan / nav.
  // At scroll edges let the wheel bubble so board pan still feels responsive.
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

  // Paper-atelier text note: a thumbnail-less card rendered as a graph / spiral
  // notepad sheet (background-size:100% 100%) with the title hand-written on it,
  // matching ImageCard's paper face. Falls through to the generated-art card
  // when the paper assets aren't placed.
  if (paper) {
    const paperId = pickTextNoteSheet(item.bookmarkId)
    const paperUrl = paperId ? paperAssetUrl(paperId) : null
    if (paperUrl) {
      return (
        <div
          className={`${styles.placeholderCard} ${styles.paperNote}`}
          ref={rootRef}
          data-paper-note="true"
          style={{ backgroundImage: `url("${paperUrl}")` }}
        >
          <div
            ref={titleScrollRef}
            className={`${styles.titleScroll} ${styles.paperNoteScroll}`}
            data-overflow={hasOverflow ? 'true' : 'false'}
            data-at-bottom={atBottom ? 'true' : 'false'}
            data-card-scroll="true"
            onScroll={updateScrollState}
            onWheel={handleCardWheel}
          >
            <div className={`${styles.titleInner} ${styles.paperNoteTitle}`} style={titleStyle}>
              {title}
            </div>
          </div>
        </div>
      )
    }
  }

  return (
    <div className={styles.placeholderCard} ref={rootRef}>
      {layerUrls.map((url, i) => (
        <div
          key={i}
          className={styles.bgLayer}
          style={{ backgroundImage: `url(${url})`, opacity: i === activeFrame ? 1 : 0 }}
          aria-hidden="true"
        />
      ))}
      <div className={styles.scrim} aria-hidden="true" />

      {!omitMeta && hostname && (
        <div className={styles.hostname}>{hostname}</div>
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
