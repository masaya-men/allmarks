'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import styles from '../Lightbox.module.css'
import { getDefaultVolume } from '@/lib/embed/default-volume'
import { EmbedPosterBox, EmbedPlayButton } from './EmbedShell'
import { useDevicePixelRatio } from '@/lib/board/use-device-pixel-ratio'
import { ambientBackingScale } from '@/lib/board/ambient-backing-scale'

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
  onUnplayable,
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
  /** Tier 1 only: called once when YouTube reports an unplayable error (embed-
   *  restricted, region-locked, deleted, etc.). The caller unmounts the overlay
   *  so the card's thumbnail shows through. Never passed for Tier 3. */
  readonly onUnplayable?: () => void
}): ReactNode {
  const [hasInteracted, setHasInteracted] = useState<boolean>(autoStart)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  // Track whether we already fired onUnplayable to guarantee at-most-once.
  const firedUnplayableRef = useRef<boolean>(false)
  // "Latest callback" ref: always holds the current onUnplayable without
  // making the detection effect depend on it (avoids per-render re-subscribe).
  const onUnplayableRef = useRef(onUnplayable)
  onUnplayableRef.current = onUnplayable
  // Stable player id shared between the detection effect and handleIframeLoad.
  const playerIdRef = useRef<string>(Math.random().toString(36).slice(2))

  // Tier 1 ambient (muted) only: lay the iframe out at a fraction of its display
  // box on high-DPR screens, then scale it back up to fill. The YouTube document
  // renders at the smaller CSS size → far fewer pixels to decode + composite,
  // which is what keeps many simultaneous autoplay previews smooth on a 4K
  // display. Re-evaluates live when the window moves to a monitor of a different
  // density. No effect on Tier 3 (sound) or the Lightbox — those run at full res.
  const dpr = useDevicePixelRatio()
  const ambientScale = muted === true ? ambientBackingScale(dpr) : 1
  const ambientStyle: CSSProperties | undefined =
    ambientScale < 1
      ? { width: `${ambientScale * 100}%`, height: `${ambientScale * 100}%`, transform: `scale(${1 / ambientScale})`, transformOrigin: 'top left' }
      : undefined

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

  // Tier 1 only: detect unplayable videos (embed-restricted, deleted, etc.)
  // via the YouTube IFrame API postMessage protocol. YouTube posts structured
  // data events when enablejsapi=1 is in the src; error codes 2, 5, 100, 101,
  // 150 all mean the video can't play in this context.
  // We send a "listening" handshake to opt in to event messages, with retries
  // since the player may not be ready immediately after iframe mount.
  //
  // The effect deps are [hasInteracted] ONLY. onUnplayable is read through
  // onUnplayableRef so that a new inline arrow from the parent (e.g. during
  // drag/scroll re-renders) does NOT tear down and re-add the listener.
  useEffect(() => {
    if (!onUnplayableRef.current || !hasInteracted) return
    const iframe = iframeRef.current
    if (!iframe?.contentWindow) return

    // YouTube error codes that mean "can't play here": invalid id (2), HTML5
    // error (5), not found/private (100), embed-disabled (101/150).
    const UNPLAYABLE_CODES = new Set([2, 5, 100, 101, 150])
    const stableId = playerIdRef.current

    const sendListening = (): void => {
      iframe.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening', id: stableId, channel: 'widget' }),
        '*',
      )
    }
    sendListening()
    const t1 = window.setTimeout(sendListening, 300)
    const t2 = window.setTimeout(sendListening, 1000)

    const handleMessage = (e: MessageEvent): void => {
      if (e.source !== iframe.contentWindow) return
      if (typeof e.data !== 'string') return
      let parsed: unknown
      try { parsed = JSON.parse(e.data) } catch { return }
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        'event' in parsed &&
        (parsed as Record<string, unknown>)['event'] === 'onError' &&
        'info' in parsed &&
        UNPLAYABLE_CODES.has(Number((parsed as Record<string, unknown>)['info']))
      ) {
        if (!firedUnplayableRef.current) {
          firedUnplayableRef.current = true
          onUnplayableRef.current?.()
        }
      }
    }
    window.addEventListener('message', handleMessage)
    return (): void => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.removeEventListener('message', handleMessage)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasInteracted])

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
    if (muted === true) {
      // Muted Tier 1: don't unmute via setVolume. But we do need to kick the
      // listening handshake immediately on iframe load so the onError detection
      // effect (which may have already run before this load fired) gets events.
      // The effect itself also retries at 300ms/1000ms from mount, so this is
      // just an additional "on load" send to cover the common case.
      // Reuse playerIdRef so both sends share the same consistent player id.
      if (onUnplayableRef.current) {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ event: 'listening', id: playerIdRef.current, channel: 'widget' }),
          '*',
        )
      }
      return
    }
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
        // Tier 1 (muted) is an ambient, non-interactive preview (the overlay is
        // pointer-events:none), so hide the player chrome: controls=0 +
        // modestbranding so it reads as motion, not a clickable player.
        // Tier 1 (muted) ambient preview also loops: short clips restart instead
        // of freezing on a final frame. YouTube only loops a single video when
        // `playlist=<id>` is also present (loop=1 alone is a no-op for one video).
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1${muted === true ? `&mute=1&controls=0&modestbranding=1&loop=1&playlist=${videoId}` : ''}`}
        title={title}
        className={styles.iframe}
        style={ambientStyle}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        onLoad={handleIframeLoad}
      />
    </div>
  )
}
