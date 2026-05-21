'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import styles from '../Lightbox.module.css'
import type { MediaSlot } from '@/lib/embed/types'
import { extractTweetId } from '@/lib/utils/url'
import { fetchTweetMeta } from '@/lib/embed/tweet-meta'
import { useDefaultVolume } from '@/lib/embed/default-volume'

export type MediaVariant = 'inline' | 'lightbox'

/** Minimal structural shape the tweet video player needs from a board/lightbox item. */
export type TweetVideoItem = {
  readonly url: string
  readonly title: string
  readonly thumbnail?: string | undefined
  readonly mediaSlots?: readonly MediaSlot[]
}

export type TweetVideoSource = {
  readonly videoUrl: string
  readonly posterUrl: string | undefined
  readonly aspect: number | undefined
}

/** Pick the playable mp4 + poster from an item's already-persisted mediaSlots.
 *  Returns null when no video slot exists yet (caller must fetch syndication
 *  meta to obtain the mp4). Pure — unit tested. */
export function resolveTweetVideoSource(item: TweetVideoItem): TweetVideoSource | null {
  const slot = item.mediaSlots?.find((s) => s.type === 'video' && s.videoUrl)
  if (!slot?.videoUrl) return null
  return { videoUrl: slot.videoUrl, posterUrl: slot.url || item.thumbnail, aspect: slot.aspect }
}

/**
 * Tweet / X video player, shared by the Lightbox (variant='lightbox') and the
 * board inline card (variant='inline'). Renders a native <video> fed by the
 * `/api/tweet-video` CORS proxy. The element type stays <video> so the
 * Lightbox's generic pause sweeps (slot-change + close-animation) keep working.
 *
 * Lightbox parity (no-breakage): variant='lightbox' reproduces the original
 * LiquidGlass play-disc + `hasInteracted` controls gating verbatim — no native
 * chrome until the first click. variant='inline' autoplays with sound (the
 * card indicator press is the user gesture) and shows native controls.
 *
 * Source resolution order: an explicitly-passed `source` (Lightbox already
 * knows it from the slot meta) → the item's persisted mediaSlots → a one-shot
 * syndication fetch (board card whose backfill hasn't landed yet).
 */
export function TweetVideoEmbed({
  item,
  source: sourceProp,
  variant,
  autoStart = false,
}: {
  readonly item: TweetVideoItem
  /** When the caller already has the mp4 (Lightbox slot meta), pass it to skip resolution. */
  readonly source?: TweetVideoSource
  readonly variant: MediaVariant
  readonly autoStart?: boolean
}): ReactNode {
  const initial = sourceProp ?? resolveTweetVideoSource(item)
  // undefined = fetch in flight, null = no playable video, value = ready.
  const [source, setSource] = useState<TweetVideoSource | null | undefined>(initial ?? undefined)
  const [videoFailed, setVideoFailed] = useState<boolean>(false)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  // Lightbox-only: gate native controls on first interaction so Chromium
  // draws no loading panel under the LiquidGlass disc (verbatim from the
  // original TweetVideoPlayer). Inline always shows controls.
  const [hasInteracted, setHasInteracted] = useState<boolean>(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [defaultVolume, setDefaultVolume] = useDefaultVolume()

  // Self-fetch the mp4 only when we couldn't resolve it from props/slots.
  useEffect(() => {
    if (initial) return
    let cancelled = false
    const id = extractTweetId(item.url)
    if (!id) {
      setSource(null)
      return
    }
    fetchTweetMeta(id)
      .then((meta) => {
        if (cancelled) return
        if (meta?.videoUrl) {
          setSource({ videoUrl: meta.videoUrl, posterUrl: meta.videoPosterUrl ?? item.thumbnail, aspect: meta.videoAspectRatio })
        } else {
          setSource(null)
        }
      })
      .catch(() => {
        if (!cancelled) setSource(null)
      })
    return (): void => {
      cancelled = true
    }
    // `initial` is derived from props that don't change for a mounted card.
  }, [item.url, item.thumbnail, initial])

  // Keep the <video> volume synced to the app-wide default (mount + cross-card).
  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = defaultVolume / 100
  }, [defaultVolume, source])

  const handleVolumeChange = (): void => {
    const v = videoRef.current?.volume
    if (typeof v === 'number') setDefaultVolume(Math.round(v * 100))
  }

  // Watch-on-X fallback: no resolvable video or playback error.
  if (source === null || videoFailed) {
    return (
      <a
        className={variant === 'lightbox' ? styles.tweetWatchOnX : styles.inlineWatchOnX}
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {item.thumbnail && <img src={item.thumbnail} alt={item.title} />}
        <span className={styles.tweetWatchOnXBadge}>Watch on X →</span>
      </a>
    )
  }

  // Still resolving — show the poster so the card/lightbox isn't blank.
  if (source === undefined) {
    return item.thumbnail
      ? <img src={item.thumbnail} alt={item.title} style={variant === 'inline' ? FILL : undefined} />
      : null
  }

  const aspect = source.aspect ?? 16 / 9
  const isVertical = aspect < 1
  const lightboxWrapper: CSSProperties = isVertical
    ? { position: 'relative', aspectRatio: aspect, height: `min(var(--lightbox-media-max-h), calc(50vw / ${aspect}))`, maxHeight: 'var(--lightbox-media-max-h)', maxWidth: '50vw', background: 'black', borderRadius: 'var(--lightbox-media-radius)', overflow: 'hidden' }
    : { position: 'relative', aspectRatio: aspect, width: `min(920px, 60vw, calc(var(--lightbox-media-max-h) * ${aspect}))`, maxHeight: 'var(--lightbox-media-max-h)', maxWidth: 'min(920px, 60vw)', background: 'black', borderRadius: 'var(--lightbox-media-radius)', overflow: 'hidden' }
  // Inline (board): fill the card; the CardsLayer overlay already centers + clips.
  const inlineWrapper: CSSProperties = { position: 'absolute', inset: 0, background: 'black', overflow: 'hidden' }
  const wrapperStyle = variant === 'lightbox' ? lightboxWrapper : inlineWrapper

  const proxiedSrc = `/api/tweet-video?url=${encodeURIComponent(source.videoUrl)}`
  const handleOverlayClick = (): void => {
    setHasInteracted(true)
    void videoRef.current?.play()
  }
  const showDisc = variant === 'lightbox' && !isPlaying

  return (
    <div style={wrapperStyle}>
      <video
        ref={videoRef}
        className={styles.tweetVideo}
        src={proxiedSrc}
        poster={source.posterUrl}
        // Inline: native controls + autoplay (the indicator press is the
        // gesture). Lightbox: controls gated on first interaction so no native
        // loading panel stacks under the LiquidGlass disc.
        controls={variant === 'inline' ? true : hasInteracted}
        autoPlay={variant === 'inline' ? autoStart : false}
        playsInline
        preload="metadata"
        onPlay={(): void => setIsPlaying(true)}
        onPause={(): void => setIsPlaying(false)}
        onEnded={(): void => setIsPlaying(false)}
        onError={(): void => setVideoFailed(true)}
        onVolumeChange={handleVolumeChange}
        style={variant === 'inline' ? FILL : undefined}
      />
      {showDisc && (
        <button
          type="button"
          className={styles.playOverlay}
          onClick={handleOverlayClick}
          aria-label="Play video"
        >
          <span className={styles.playDisc} aria-hidden="true">
            <svg viewBox="0 0 24 24" className={styles.playOverlayIcon} aria-hidden="true">
              <path d="M6.5 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  )
}

const FILL: CSSProperties = { width: '100%', height: '100%', objectFit: 'contain', background: 'black' }
