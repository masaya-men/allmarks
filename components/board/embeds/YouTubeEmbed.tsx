'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import styles from '../Lightbox.module.css'
import { getDefaultVolume } from '@/lib/embed/default-volume'
import { EmbedPosterBox, EmbedPlayButton } from './EmbedShell'

export function YouTubeEmbed({
  videoId,
  title,
  vertical,
  thumbnail,
  aspectRatio,
  autoStart = false,
  volume,
  paused,
  muted,
}: {
  readonly videoId: string
  readonly title: string
  readonly vertical: boolean
  readonly thumbnail: string | undefined
  readonly aspectRatio: number | undefined
  /** When true, skip the poster+play step and mount the player immediately.
   *  Used for Tier 3 inline cards where the indicator press IS the user
   *  gesture that satisfies the autoplay-with-sound policy. Lightbox leaves
   *  it false so the poster→click experience is unchanged. */
  readonly autoStart?: boolean
  /** Controlled per-card volume (0–100) for inline cards. */
  readonly volume?: number
  /** Controlled play/pause for inline cards. */
  readonly paused?: boolean
  /** Tier 1 viewport autoplay: start muted via `&mute=1` (no audio, autoplay-safe). */
  readonly muted?: boolean
}): ReactNode {
  const [hasInteracted, setHasInteracted] = useState<boolean>(autoStart)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  // Inline external-control bridge: once the iframe is mounted, drive volume
  // and play/pause via the YouTube iframe API (enablejsapi=1). Volume changes
  // here are per-card and do not touch the global default.
  const post = (msg: object): void => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify(msg), 'https://www.youtube.com')
  }
  useEffect(() => {
    if (muted === true) return // muted hover playback: leave mute=1 untouched
    if (hasInteracted && typeof volume === 'number') post({ event: 'command', func: 'setVolume', args: [volume] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume, hasInteracted])
  useEffect(() => {
    if (!hasInteracted || typeof paused !== 'boolean') return
    post({ event: 'command', func: paused ? 'pauseVideo' : 'playVideo' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, hasInteracted])
  // YouTube CDN poster — used only as fallback when the bookmarklet
  // didn't capture an og:image. maxresdefault works for ~95% of videos;
  // hqdefault is the universal fallback if max isn't available, but we
  // only reach this code path when item.thumbnail is missing entirely.
  const poster = thumbnail || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`

  // Push the AllMarks default volume preference into the player on load.
  // `enablejsapi=1` (added in the iframe src) is what makes YouTube
  // respond to postMessage commands at all. We don't go through the full
  // listening/onReady handshake — we just fire-and-forget setVolume a few
  // times around iframe load, because:
  //   (a) the player accepts commands before READY is dispatched and
  //       silently buffers them, so an early send is fine;
  //   (b) network jitter sometimes delays player init past `load`, so the
  //       small retry cluster catches slow connections without needing a
  //       full event subscription protocol.
  // YouTube's own volume slider remains active inside the player chrome,
  // so users can override on a per-video basis if they want louder/quieter.
  const handleIframeLoad = (): void => {
    if (muted === true) return // muted hover playback: don't unmute via setVolume
    const vol = getDefaultVolume()
    const send = (): void => {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'setVolume', args: [vol] }),
        'https://www.youtube.com',
      )
    }
    send()
    window.setTimeout(send, 500)
    window.setTimeout(send, 1500)
  }

  // Pre-play: render the poster at the *board card's* aspect so the open
  // animation's clone→media swap is invisible. The iframe wrap (16:9 /
  // 9:16) only mounts after the user clicks play — at that moment the
  // aspect snaps to YouTube's native player shape, which is acceptable
  // because it follows a deliberate user gesture (B-#17-#2).
  if (!hasInteracted) {
    return (
      <EmbedPosterBox
        aspectRatio={aspectRatio}
        fallbackAspect={vertical ? 9 / 16 : 16 / 9}
        thumbnail={poster}
        alt={title}
      >
        <EmbedPlayButton onClick={(): void => setHasInteracted(true)} />
      </EmbedPosterBox>
    )
  }

  return (
    <div className={vertical ? styles.iframeWrap9x16 : styles.iframeWrap16x9}>
      <iframe
        ref={iframeRef}
        // autoplay=1 starts playback immediately on the first iframe
        // mount, which is allowed because the click on our overlay
        // satisfies Chromium's user-gesture requirement for autoplay.
        // enablejsapi=1 lets us push the default volume in via postMessage.
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1${muted === true ? '&mute=1' : ''}`}
        title={title}
        className={styles.iframe}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        onLoad={handleIframeLoad}
      />
    </div>
  )
}
