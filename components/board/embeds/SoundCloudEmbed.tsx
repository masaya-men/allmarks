'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import styles from '../Lightbox.module.css'
import { useDefaultVolume, getDefaultVolume } from '@/lib/embed/default-volume'
import { loadSoundCloudWidget, type SoundCloudWidget } from '@/lib/embed/soundcloud-widget'
import { EmbedPosterBox, EmbedPlayButton } from './EmbedShell'

/** SoundCloud track — poster→player pattern like YouTube/Vimeo, but the
 *  payload is SoundCloud's official `w.soundcloud.com/player` iframe with
 *  `visual=true` which renders the artwork + waveform in a square frame.
 *  Public tracks play without authentication; private tracks return a
 *  "Sorry! Something went wrong" notice inside the player, which is the
 *  correct affordance. We pass the canonical track URL through verbatim
 *  rather than extracting an ID because SoundCloud's player resolves
 *  `?url=` against its own API and that's what the official embed code
 *  uses. */
export function SoundCloudEmbed({
  url,
  title,
  thumbnail,
  aspectRatio,
  autoStart = false,
}: {
  readonly url: string
  readonly title: string
  readonly thumbnail: string | undefined
  readonly aspectRatio: number | undefined
  /** When true, mount the player immediately (Tier 3 inline). See YouTubeEmbed. */
  readonly autoStart?: boolean
}): ReactNode {
  const [hasInteracted, setHasInteracted] = useState<boolean>(autoStart)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const widgetRef = useRef<SoundCloudWidget | null>(null)
  const [volume, setVolume] = useDefaultVolume()
  const [isControlsVisible, setIsControlsVisible] = useState<boolean>(false)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const hideTimerRef = useRef<number | null>(null)
  // Tracks the last non-zero volume so the mute button can restore where
  // the user left it. Mirrors YouTube/Spotify behavior: mute → 0, unmute →
  // back to the prior value, not the platform default.
  const previousVolumeRef = useRef<number>(volume > 0 ? volume : 50)
  const playerSrc = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=true&visual=true&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`

  // Once the user has clicked our pre-play poster the iframe mounts. We
  // lazy-load SoundCloud's Widget API script and grab a widget handle to
  // the iframe so the custom volume slider (= AllMarks chrome) can drive
  // the player. setVolume on READY ensures the default volume preference
  // applies to the very first second of playback rather than starting at
  // SoundCloud's own default (which is loud).
  useEffect(() => {
    if (!hasInteracted) return
    let cancelled = false
    loadSoundCloudWidget()
      .then((SC) => {
        if (cancelled || !iframeRef.current) return
        const widget = SC.Widget(iframeRef.current)
        widgetRef.current = widget
        widget.bind(SC.Widget.Events.READY, () => {
          if (cancelled) return
          widget.setVolume(getDefaultVolume())
        })
      })
      .catch(() => {
        // Widget API script failed to load (= offline / blocked). Player
        // still works via SoundCloud's own UI inside the iframe; the
        // overlay slider is the only thing degraded. Don't blow up.
      })
    return (): void => {
      cancelled = true
      widgetRef.current = null
    }
  }, [hasInteracted])

  const showControls = useCallback((): void => {
    setIsControlsVisible(true)
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  const scheduleHide = useCallback((): void => {
    if (isDragging) return
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = window.setTimeout(() => {
      setIsControlsVisible(false)
      hideTimerRef.current = null
    }, 1500)
  }, [isDragging])

  // Cleanup the hide timer if the embed unmounts mid-countdown.
  useEffect(() => {
    return (): void => {
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current)
    }
  }, [])

  const handleVolumeChange = (newVolume: number): void => {
    const clamped = Math.max(0, Math.min(100, Math.round(newVolume)))
    setVolume(clamped)
    if (clamped > 0) previousVolumeRef.current = clamped
    widgetRef.current?.setVolume(clamped)
  }

  const handleMuteToggle = (): void => {
    if (volume === 0) {
      handleVolumeChange(previousVolumeRef.current || 50)
    } else {
      previousVolumeRef.current = volume
      handleVolumeChange(0)
    }
  }

  if (!hasInteracted) {
    return (
      <EmbedPosterBox
        aspectRatio={aspectRatio}
        fallbackAspect={1}
        thumbnail={thumbnail}
        alt={title}
      >
        <EmbedPlayButton onClick={(): void => setHasInteracted(true)} />
      </EmbedPosterBox>
    )
  }

  return (
    <div
      className={styles.iframeWrap1x1}
      onMouseEnter={showControls}
      onMouseLeave={scheduleHide}
    >
      <iframe
        ref={iframeRef}
        src={playerSrc}
        title={title}
        className={styles.iframe}
        // SoundCloud's official embed snippet ships with just `allow="autoplay"`
        // but in session 51 the widget loaded fine yet refused to start playback
        // on click. Mirroring YouTube's wider permission set fixes this — the
        // widget audio engine appears to need `encrypted-media` (EME) for some
        // tracks, and Chromium honors the parent-document user gesture chain
        // more reliably when the iframe's permission delegation is explicit.
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      />
      <div
        className={styles.volumeControl}
        data-visible={isControlsVisible}
      >
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={volume}
          className={styles.volumeSlider}
          style={{ ['--fill' as string]: `${volume}%` } as CSSProperties}
          onChange={(e): void => handleVolumeChange(Number.parseInt(e.target.value, 10))}
          onMouseDown={(): void => setIsDragging(true)}
          onMouseUp={(): void => {
            setIsDragging(false)
            scheduleHide()
          }}
          onTouchStart={(): void => setIsDragging(true)}
          onTouchEnd={(): void => {
            setIsDragging(false)
            scheduleHide()
          }}
          aria-label="音量"
        />
        <button
          type="button"
          className={styles.volumeMute}
          onClick={handleMuteToggle}
          aria-label={volume === 0 ? 'ミュート解除' : 'ミュート'}
          title={volume === 0 ? 'ミュート解除' : 'ミュート'}
        >
          {volume === 0 ? (
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
              <path d="M3.63 3.63 2.21 5.05 6.16 9H4v6h4l5 5v-6.17l4.18 4.18a6.94 6.94 0 0 1-1.18.83v2.06a8.94 8.94 0 0 0 2.61-1.49L19.95 21l1.41-1.41ZM13 5v3.17l4.97 4.97A6.97 6.97 0 0 0 16.5 12c0-2.21-1.16-4.13-2.9-5.23v2.12a3 3 0 0 1 1.4 2.51l-2-2V4l-1.04 1.04A4.99 4.99 0 0 1 13 5Z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
