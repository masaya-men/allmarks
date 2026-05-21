'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import styles from '../Lightbox.module.css'
import type { TikTokPlayback } from '@/lib/embed/types'
import { fetchTikTokPlayback } from '@/lib/embed/tiktok-meta'
import { useDefaultVolume } from '@/lib/embed/default-volume'
import { EmbedPosterBox, EmbedPlayButton } from './EmbedShell'

/** TikTok video — 3-tier fallback playback strategy.
 *
 *  Tier 1 (best UX, when it works): server-side scrape of
 *  `tiktok.com/@user/video/<id>` HTML for the
 *  `__UNIVERSAL_DATA_FOR_REHYDRATION__` JSON, which contains a signed
 *  `playAddr` mp4 URL. We feed that URL through our `/api/tiktok-video`
 *  proxy (TikTok CDN gates on Referer) and render a clean `<video>` with
 *  native controls — visually matching how Twitter/X videos play.
 *
 *  Tier 2 (graceful fallback): TikTok's official embed iframe
 *  `tiktok.com/embed/v2/<id>`. Plays the video reliably but ships with
 *  cluttered chrome (related-videos sidebar, "今すぐ見る" CTA, scrollbar)
 *  which we can't hide because the iframe is cross-origin. Used when the
 *  scrape returns no playAddr — typically because TikTok's WAF challenged
 *  our server-side fetch or the rehydration JSON shape changed.
 *
 *  Tier 3 (extremely rare): the right-hand text panel always shows a
 *  `sourceLink` to TikTok, so even if Tier 2's iframe fails to load the
 *  user has a manual escape hatch. Not auto-rendered as a separate
 *  state because the iframe is reliable enough to make Tier 3
 *  unnecessary in practice.
 *
 *  Timing: the scrape kicks off in a useEffect on mount, in parallel with
 *  the FLIP open animation, so by the time the user clicks play the
 *  result is usually already in. If it isn't, we give it 1.5s after the
 *  click then commit to Tier 2 — never leave the user staring at a
 *  paused poster. */
export function TikTokEmbed({
  videoId,
  url,
  thumbnail,
  title,
  aspectRatio,
  autoStart = false,
  volume,
  paused,
}: {
  readonly videoId: string
  readonly url: string
  readonly thumbnail: string | undefined
  readonly title: string
  readonly aspectRatio: number | undefined
  /** When true, skip the poster+play step (Tier 3 inline). See YouTubeEmbed. */
  readonly autoStart?: boolean
  /** Controlled per-card volume (0–100) for inline. Tier-2 iframe can't honor it. */
  readonly volume?: number
  /** Controlled play/pause for inline (Tier-1 native video only). */
  readonly paused?: boolean
}): ReactNode {
  const [hasInteracted, setHasInteracted] = useState<boolean>(autoStart)
  // undefined = scrape in flight, null = scrape failed, value = success
  const [playback, setPlayback] = useState<TikTokPlayback | null | undefined>(undefined)
  // Once decided, this state is sticky — we don't switch tiers mid-stream
  // even if a slow scrape result lands after we already committed to Tier 2.
  const [tier, setTier] = useState<'poster' | 'video' | 'iframe'>('poster')
  // Native-video Tier 1 honors volume. Tier 2 (= TikTok's official iframe)
  // can't be controlled from outside — known limitation, accepted by user.
  const tier1VideoRef = useRef<HTMLVideoElement>(null)
  const [defaultVolume, setDefaultVolume] = useDefaultVolume()
  // Controlled (inline) per-card volume wins; otherwise the global default.
  // Inline never writes back to the global default.
  const controlled = typeof volume === 'number'
  useEffect(() => {
    if (tier1VideoRef.current && controlled) tier1VideoRef.current.volume = (volume as number) / 100
  }, [volume, controlled, tier])
  useEffect(() => {
    if (tier1VideoRef.current && !controlled) tier1VideoRef.current.volume = defaultVolume / 100
  }, [defaultVolume, controlled, tier])
  // Controlled play/pause for the Tier-1 native video.
  useEffect(() => {
    const el = tier1VideoRef.current
    if (!el || typeof paused !== 'boolean') return
    if (paused) el.pause()
    else void el.play().catch(() => { /* autoplay race; ignore */ })
  }, [paused, tier])
  const handleTier1VolumeChange = (): void => {
    const v = tier1VideoRef.current?.volume
    if (typeof v === 'number') {
      setDefaultVolume(Math.round(v * 100))
    }
  }

  // Kick off the scrape on mount, in parallel with the FLIP open animation.
  // Most of the time (~2-5s typical) it lands before the user clicks play.
  useEffect(() => {
    let cancelled = false
    fetchTikTokPlayback(url).then((p) => {
      if (cancelled) return
      setPlayback(p)
    })
    return (): void => { cancelled = true }
  }, [url])

  // Once the user clicks play, decide which tier to render. If the scrape
  // is already done, decide immediately. Otherwise wait up to 1.5s for it
  // to land before falling back to the iframe.
  useEffect(() => {
    if (!hasInteracted || tier !== 'poster') return
    if (playback !== undefined) {
      setTier(playback ? 'video' : 'iframe')
      return
    }
    const timer = setTimeout(() => setTier('iframe'), 1500)
    return (): void => clearTimeout(timer)
  }, [hasInteracted, playback, tier])

  // No thumbnail captured by the bookmarklet → can't show our poster +
  // LiquidGlass overlay (would just hover over a black square). Skip the
  // poster step and mount the iframe straight away.
  if (!thumbnail) {
    return (
      <div className={styles.iframeWrap9x16}>
        <iframe
          src={`https://www.tiktok.com/embed/v2/${videoId}`}
          title="TikTok video"
          className={styles.iframe}
          allow="encrypted-media"
          allowFullScreen
        />
      </div>
    )
  }

  if (tier === 'poster') {
    return (
      <EmbedPosterBox
        aspectRatio={aspectRatio}
        fallbackAspect={9 / 16}
        thumbnail={thumbnail}
        alt={title}
      >
        <EmbedPlayButton onClick={(): void => setHasInteracted(true)} />
      </EmbedPosterBox>
    )
  }

  if (tier === 'video' && playback) {
    // Build the proxy URL with the captured TikTok session cookies. The
    // CDN binds the signed playAddr to the session that issued it, so
    // without `c` (the cookie string from the scrape) the upstream
    // returns 403 even with the right Referer.
    const proxyUrl = playback.cookieString
      ? `/api/tiktok-video?url=${encodeURIComponent(playback.playAddr)}&c=${encodeURIComponent(playback.cookieString)}`
      : `/api/tiktok-video?url=${encodeURIComponent(playback.playAddr)}`
    return (
      <div className={styles.iframeWrap9x16}>
        <video
          ref={tier1VideoRef}
          className={styles.inlineVideo}
          src={proxyUrl}
          poster={playback.cover || thumbnail}
          controls
          autoPlay
          playsInline
          onVolumeChange={controlled ? undefined : handleTier1VolumeChange}
        />
      </div>
    )
  }

  // tier === 'iframe' (or 'video' but playback unexpectedly null)
  return (
    <div className={styles.iframeWrap9x16}>
      <iframe
        src={`https://www.tiktok.com/embed/v2/${videoId}`}
        title="TikTok video"
        className={styles.iframe}
        allow="encrypted-media"
        allowFullScreen
      />
    </div>
  )
}
