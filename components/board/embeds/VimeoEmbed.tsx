'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import styles from '../Lightbox.module.css'
import { getDefaultVolume } from '@/lib/embed/default-volume'
import { EmbedPosterBox, EmbedPlayButton } from './EmbedShell'

/** Vimeo video — same poster→iframe pattern as YouTube. Public videos play
 *  via `player.vimeo.com/video/<id>` without authentication. Private /
 *  login-walled videos can't be embedded by any third-party client; for
 *  those the user will see Vimeo's own "Private video" notice inside the
 *  iframe, which is the correct affordance. */
export function VimeoEmbed({
  videoId,
  title,
  thumbnail,
  aspectRatio,
  autoStart = false,
  volume,
  paused,
  muted,
  onUnplayable,
  onPlaying,
}: {
  readonly videoId: string
  readonly title: string
  readonly thumbnail: string | undefined
  readonly aspectRatio: number | undefined
  /** When true, mount the player immediately (Tier 3 inline). See YouTubeEmbed. */
  readonly autoStart?: boolean
  /** Controlled per-card volume (0–100) for inline cards. */
  readonly volume?: number
  /** Controlled play/pause for inline cards. */
  readonly paused?: boolean
  /** Tier 1 viewport autoplay: start muted via `&muted=1` (no audio, autoplay-safe). */
  readonly muted?: boolean
  /** Tier 1 only: called once when Vimeo reports a playback error (private,
   *  region-locked, etc.). The caller unmounts the overlay so the card's
   *  thumbnail shows through. Never passed for Tier 3. */
  readonly onUnplayable?: () => void
  /** Tier 1 only: called once when Vimeo reports it is actually playing, so the
   *  caller reveals the overlay only then (loading stays behind the thumbnail). */
  readonly onPlaying?: () => void
}): ReactNode {
  const [hasInteracted, setHasInteracted] = useState<boolean>(autoStart)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  // Track whether we already fired onUnplayable to guarantee at-most-once.
  const firedUnplayableRef = useRef<boolean>(false)
  // "Latest callback" ref: always holds the current onUnplayable without
  // making the detection effect depend on it (avoids per-render re-subscribe).
  const onUnplayableRef = useRef(onUnplayable)
  onUnplayableRef.current = onUnplayable
  const onPlayingRef = useRef(onPlaying)
  onPlayingRef.current = onPlaying
  const firedPlayingRef = useRef<boolean>(false)

  // Inline external-control bridge via the Vimeo Player API postMessage.
  const post = (msg: object): void => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify(msg), 'https://player.vimeo.com')
  }
  useEffect(() => {
    if (muted === true) return // muted hover playback: leave muted=1 untouched
    if (hasInteracted && typeof volume === 'number') post({ method: 'setVolume', value: volume / 100 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume, hasInteracted])
  useEffect(() => {
    if (!hasInteracted || typeof paused !== 'boolean') return
    post({ method: paused ? 'pause' : 'play' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, hasInteracted])

  // Tier 1 only: detect unplayable Vimeo videos via the Vimeo Player API.
  // After the iframe loads we subscribe to the 'error' event; Vimeo posts
  // back { event: 'error', data: { message, method } } for private / region-
  // locked / deleted videos.
  //
  // The effect deps are [hasInteracted] ONLY. onUnplayable is read through
  // onUnplayableRef so that a new inline arrow from the parent (e.g. during
  // drag/scroll re-renders) does NOT tear down and re-add the listener.
  useEffect(() => {
    if ((!onUnplayableRef.current && !onPlayingRef.current) || !hasInteracted) return
    const iframe = iframeRef.current
    if (!iframe?.contentWindow) return

    // Subscribe to Vimeo error + play events.
    iframe.contentWindow.postMessage(JSON.stringify({ method: 'addEventListener', value: 'error' }), 'https://player.vimeo.com')
    iframe.contentWindow.postMessage(JSON.stringify({ method: 'addEventListener', value: 'play' }), 'https://player.vimeo.com')

    const handleMessage = (e: MessageEvent): void => {
      if (e.source !== iframe.contentWindow) return
      if (typeof e.data !== 'string') return
      let parsed: unknown
      try { parsed = JSON.parse(e.data) } catch { return }
      if (parsed === null || typeof parsed !== 'object' || !('event' in parsed)) return
      const evName = (parsed as Record<string, unknown>)['event']
      if ((evName === 'play' || evName === 'playing') && !firedPlayingRef.current) {
        firedPlayingRef.current = true
        onPlayingRef.current?.()
        return
      }
      if (evName === 'error') {
        if (!firedUnplayableRef.current) {
          firedUnplayableRef.current = true
          onUnplayableRef.current?.()
        }
      }
    }
    window.addEventListener('message', handleMessage)
    // Fallback: reveal anyway if no play event arrives within 3s.
    const tPlay = window.setTimeout(() => {
      if (!firedPlayingRef.current) { firedPlayingRef.current = true; onPlayingRef.current?.() }
    }, 3000)
    return (): void => {
      window.clearTimeout(tPlay)
      window.removeEventListener('message', handleMessage)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasInteracted])

  // Vimeo's Player API takes setVolume(0–1) via postMessage and accepts
  // commands the moment the player has booted, which is shortly after the
  // iframe `load` event. We use the same fire-and-forget retry approach
  // as YouTube — see that handler for rationale. Vimeo's chrome keeps its
  // own volume slider so users can adjust per video.
  const handleIframeLoad = (): void => {
    // For Tier 1 (muted + onUnplayable): subscribe to error events on load.
    if (onUnplayableRef.current) {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ method: 'addEventListener', value: 'error' }),
        'https://player.vimeo.com',
      )
    }
    if (muted === true) return // muted hover playback: don't unmute via setVolume
    const vol = getDefaultVolume() / 100
    const send = (): void => {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ method: 'setVolume', value: vol }),
        'https://player.vimeo.com',
      )
    }
    send()
    window.setTimeout(send, 500)
    window.setTimeout(send, 1500)
  }

  if (!hasInteracted) {
    return (
      <EmbedPosterBox
        aspectRatio={aspectRatio}
        fallbackAspect={16 / 9}
        thumbnail={thumbnail}
        alt={title}
      >
        <EmbedPlayButton onClick={(): void => setHasInteracted(true)} />
      </EmbedPosterBox>
    )
  }

  return (
    <div className={styles.iframeWrap16x9}>
      <iframe
        ref={iframeRef}
        // Tier 1 (muted) ambient preview: hide Vimeo's chrome (controls=0) so it
        // reads as motion, not a clickable player.
        // Tier 1 (muted) also loops so short clips restart instead of freezing.
        src={`https://player.vimeo.com/video/${videoId}?autoplay=1${muted === true ? '&muted=1&controls=0&loop=1' : ''}`}
        title={title}
        className={styles.iframe}
        allow="autoplay; fullscreen; picture-in-picture; clipboard-write"
        allowFullScreen
        onLoad={handleIframeLoad}
      />
    </div>
  )
}
