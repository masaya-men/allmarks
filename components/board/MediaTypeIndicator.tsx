'use client'

import { type PointerEvent as ReactPointerEvent, type ReactElement } from 'react'
import styles from './MediaTypeIndicator.module.css'

export type MediaType = 'video' | 'photo' | 'audio'

type Props = {
  /** null hides the indicator entirely (e.g. text-only cards — the type
   *  is already obvious from the card content, no badge needed). */
  readonly type: MediaType | null
  readonly visible: boolean
  /** When provided, the indicator becomes an interactive toggle button.
   *  Pressing it activates inline playback-with-audio for the card.
   *  Absent → the indicator stays a passive badge (photo cards, etc.). */
  readonly onActivate?: () => void
  /** True when this card is currently the audio-active card (Tier 3). */
  readonly active?: boolean
}

/**
 * Bottom-right card indicator. For photo (and non-playable) cards it stays a
 * passive badge that only tells the user the media type on hover. For
 * video/audio cards with `onActivate`, it becomes a clickable toggle that
 * starts/stops inline playback-with-audio (multi-playback Tier 3).
 *
 * Interaction safety (mirrors CardCornerActions): the button sits at
 * z-index 50 (above the resize handle's 30) but only consumes pointer
 * events on its own footprint, and stops pointerdown propagation so the
 * card reorder drag never engages. It is anchored 8px inside the corner
 * and grows INWARD on hover, so the corner tip + outer ring stay free for
 * the bottom-right resize handle.
 */
export function MediaTypeIndicator({
  type,
  visible,
  onActivate,
  active = false,
}: Props): ReactElement | null {
  if (type === null) return null

  const interactive = typeof onActivate === 'function'
  // While active (playing) the control reads as "press to stop" → ■ glyph.
  // Idle, it keeps the media-type glyph so the card still signals video vs audio.
  const iconKind = active ? 'stop' : type === 'video' ? 'video' : type === 'audio' ? 'audio' : 'photo'
  const icon =
    iconKind === 'stop' ? <StopIcon />
      : iconKind === 'video' ? <VideoIcon />
        : iconKind === 'audio' ? <MusicIcon />
          : <PhotoIcon />

  if (!interactive) {
    return (
      <div
        className={styles.indicator}
        data-testid="media-indicator"
        data-icon={iconKind}
        data-visible={visible}
        aria-label={type}
      >
        {icon}
      </div>
    )
  }

  const swallow = (e: ReactPointerEvent<HTMLButtonElement>): void => {
    e.stopPropagation()
  }

  return (
    <button
      type="button"
      className={styles.indicator + ' ' + styles.interactive}
      data-testid="media-indicator"
      data-icon={iconKind}
      data-visible={visible}
      data-active={active ? 'true' : 'false'}
      aria-label={type === 'video' ? 'Play with sound' : type === 'audio' ? 'Play audio' : 'Play'}
      aria-pressed={active}
      onPointerDown={swallow}
      onMouseDown={swallow}
      onClick={(e): void => {
        e.stopPropagation()
        onActivate?.()
      }}
    >
      {icon}
    </button>
  )
}

/** Stop square — shown while a card is actively playing so the corner control
 *  reads as "press to stop" rather than just glowing. */
function StopIcon(): ReactElement {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  )
}

/** Filmstrip icon — reads as "video" without the play-button shape that
 *  we explicitly removed from the card thumbnails. */
function VideoIcon(): ReactElement {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 9h2M3 15h2M19 9h2M19 15h2" />
      <path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Beamed eighth-note — universally read as "audio / music" (SoundCloud
 *  and other audio cards), distinct from the video filmstrip. The note
 *  heads are filled so the glyph stays legible at 12–18px. */
function MusicIcon(): ReactElement {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 17V5l10-2v12" />
      <circle cx="6" cy="17" r="3" fill="currentColor" stroke="none" />
      <circle cx="16" cy="15" r="3" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Image / photo frame icon (mountain peak + sun) — universally read
 *  as "still image" across most icon sets. */
function PhotoIcon(): ReactElement {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="9" r="1.5" fill="currentColor" stroke="none" />
      <path d="M21 16l-5-5-7 7" />
    </svg>
  )
}
