'use client'

import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import type { BoardItem } from '@/lib/storage/use-board-data'
import type { DisplayMode } from '@/lib/board/types'
import type { MediaSlot } from '@/lib/embed/types'
import { detectUrlType, isInstagramReel } from '@/lib/utils/url'
import { MinimalCard } from './MinimalCard'
import styles from './ImageCard.module.css'

type Props = {
  readonly item: BoardItem
  readonly displayMode: DisplayMode
  readonly persistMeasuredAspect?: (cardId: string, aspectRatio: number) => Promise<void>
  readonly cardWidth?: number
  readonly cardHeight?: number
  /** Tier 1: advance through mediaSlots on an interval (hard cut). */
  readonly autoCycle?: boolean
  /** Interval per image in ms (default 2200). */
  readonly cycleMs?: number
}

const ASPECT_EPSILON = 0.005

export function ImageCard({ item, persistMeasuredAspect, autoCycle = false, cycleMs = 2200 }: Props): ReactNode {
  const imgRef = useRef<HTMLImageElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  // I-07 + mix-tweet: prefer mediaSlots[] (v13) when present; fall back to
  // photos[] (v12 legacy records) by widening each URL into a synthetic
  // photo slot. Single-element / undefined results suppress dots + hover
  // swap (= 既存挙動).
  const slots: readonly MediaSlot[] = item.mediaSlots
    ?? (item.photos ?? []).map((url): MediaSlot => ({ type: 'photo', url }))
  const hasMultiple = slots.length > 1

  // Random starting slot so cards mounted together don't all begin on slot 0.
  const [imageIdx, setImageIdx] = useState<number>(() =>
    autoCycle && hasMultiple ? Math.floor(Math.random() * slots.length) : 0,
  )
  const [hasError, setHasError] = useState<boolean>(false)

  // Reset error state when the item's URL changes (e.g. card re-used for different bookmark)
  useEffect(() => {
    setHasError(false)
  }, [item.url])

  const handleImgError = useCallback((): void => {
    setHasError(true)
  }, [])

  const urlType = detectUrlType(item.url)
  // Instagram-reel-only treatment: soften the JPEG-baked play icon that
  // Instagram bakes into the og:image so it doesn't visually compete with
  // the rest of the board. The tint stays even though the play overlay
  // was removed in v59 — IG's printed icon is part of the image pixels
  // and would otherwise stick out as the only "loud" element on a clean
  // board. The hover-revealed MediaTypeIndicator (in CardsLayer) is
  // what tells the user "this is a video"; the tint just neutralises
  // the rogue printed icon underneath.
  const isReel = urlType === 'instagram' && isInstagramReel(item.url)

  useEffect(() => {
    if (!autoCycle || !hasMultiple) return
    // Per-card random interval band so cards never tick in lockstep — without
    // this every multi-photo tweet on screen advances together every cycleMs.
    const minMs = cycleMs * 0.6
    const maxMs = cycleMs * 1.8
    let timer: number
    const step = (): number => minMs + Math.random() * (maxMs - minMs)
    const tick = (): void => {
      setImageIdx((prev) => (prev + 1) % slots.length)
      timer = window.setTimeout(tick, step())
    }
    // Initial offset spread across the full cycle so cards desync immediately.
    timer = window.setTimeout(tick, Math.random() * maxMs)
    return (): void => window.clearTimeout(timer)
  }, [autoCycle, hasMultiple, slots.length, cycleMs])

  // Reset to the lead image when autoCycle turns off so the card is never
  // left stranded mid-sequence.
  useEffect(() => {
    if (!autoCycle) setImageIdx(0)
  }, [autoCycle])

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>): void => {
      if (!hasMultiple) return
      const el = cardRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0) return
      const raw = (e.clientX - rect.left) / rect.width
      const ratio = raw < 0 ? 0 : raw > 1 ? 1 : raw
      const rawIdx = Math.floor(ratio * slots.length)
      const idx = rawIdx >= slots.length ? slots.length - 1 : rawIdx < 0 ? 0 : rawIdx
      setImageIdx((prev) => (prev === idx ? prev : idx))
    },
    [hasMultiple, slots.length],
  )

  const handlePointerLeave = useCallback((): void => {
    setImageIdx((prev) => (prev === 0 ? prev : 0))
  }, [])

  // Re-measure intrinsic aspect from natural width/height once the thumbnail
  // loads. This corrects stale aspectRatio values written by previous
  // implementations (e.g. tweets that were saved by the old TweetCard with
  // its react-tweet height measurement, then later re-routed here as plain
  // images — the persisted aspect no longer matches the actual og:image).
  useEffect(() => {
    if (!persistMeasuredAspect || !item.thumbnail) return
    const img = imgRef.current
    if (!img) return
    const measure = (): void => {
      const w = img.naturalWidth
      const h = img.naturalHeight
      if (w <= 0 || h <= 0) return
      const aspect = w / h
      if (Math.abs(aspect - item.aspectRatio) < ASPECT_EPSILON) return
      void persistMeasuredAspect(item.cardId, aspect)
    }
    if (img.complete && img.naturalWidth > 0) {
      measure()
      return undefined
    }
    img.addEventListener('load', measure)
    return (): void => img.removeEventListener('load', measure)
  }, [item.cardId, item.aspectRatio, item.thumbnail, persistMeasuredAspect])

  const thumbClass = isReel
    ? `${styles.thumb} ${styles.thumbInstagramReel}`
    : styles.thumb

  return (
    <div
      ref={cardRef}
      className={styles.imageCard}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {hasError ? (
        <MinimalCard item={item} />
      ) : slots.length > 0 ? (
        slots.map((slot, i) => (
          <img
            key={slot.url}
            ref={i === 0 ? imgRef : undefined}
            className={thumbClass}
            src={slot.url}
            alt={item.title}
            draggable={false}
            loading="lazy"
            data-active={i === imageIdx ? 'true' : undefined}
            onError={handleImgError}
          />
        ))
      ) : (
        item.thumbnail && (
          <img
            ref={imgRef}
            className={thumbClass}
            src={item.thumbnail}
            alt={item.title}
            draggable={false}
            loading="lazy"
            data-active="true"
            onError={handleImgError}
          />
        )
      )}
      {/* Reel-only tint dims the area where IG's printed play icon usually
          sits, neutralising it without adding our own loud overlay. */}
      {!hasError && isReel && <div className={styles.tintInstagramReel} aria-hidden="true" />}
      {!hasError && hasMultiple && (
        <div className={styles.multiImageDots} aria-hidden="true">
          {slots.map((s, i) => (
            <span
              key={i}
              data-testid="multi-image-dot"
              data-active={i === imageIdx ? 'true' : 'false'}
              data-slot-type={s.type}
              className={styles.multiImageDot}
            />
          ))}
        </div>
      )}
    </div>
  )
}
