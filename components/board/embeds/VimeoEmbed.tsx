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
}): ReactNode {
  const [hasInteracted, setHasInteracted] = useState<boolean>(autoStart)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  // Inline external-control bridge via the Vimeo Player API postMessage.
  const post = (msg: object): void => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify(msg), 'https://player.vimeo.com')
  }
  useEffect(() => {
    if (hasInteracted && typeof volume === 'number') post({ method: 'setVolume', value: volume / 100 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume, hasInteracted])
  useEffect(() => {
    if (!hasInteracted || typeof paused !== 'boolean') return
    post({ method: paused ? 'pause' : 'play' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, hasInteracted])

  // Vimeo's Player API takes setVolume(0–1) via postMessage and accepts
  // commands the moment the player has booted, which is shortly after the
  // iframe `load` event. We use the same fire-and-forget retry approach
  // as YouTube — see that handler for rationale. Vimeo's chrome keeps its
  // own volume slider so users can adjust per video.
  const handleIframeLoad = (): void => {
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
        src={`https://player.vimeo.com/video/${videoId}?autoplay=1`}
        title={title}
        className={styles.iframe}
        allow="autoplay; fullscreen; picture-in-picture; clipboard-write"
        allowFullScreen
        onLoad={handleIframeLoad}
      />
    </div>
  )
}
