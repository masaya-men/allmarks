'use client'

import { type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react'
import styles from './PlaybackControlBar.module.css'

type Props = {
  /** 0–100. Per-card ephemeral volume. */
  readonly volume: number
  readonly paused: boolean
  readonly onVolumeChange: (next: number) => void
  readonly onTogglePause: () => void
}

/**
 * AllMarks audio-mixer styled control bar for the single active inline card.
 * Anchored just below the card (see CardsLayer). Fixed comfortable size so it
 * stays operable even when the card itself is small. Volume is per-card and
 * ephemeral (see BoardRoot). stopPropagation on pointer/click keeps the card's
 * reorder-drag / open-lightbox gesture from firing.
 */
export function PlaybackControlBar({ volume, paused, onVolumeChange, onTogglePause }: Props): ReactElement {
  const swallow = (e: ReactPointerEvent<HTMLDivElement>): void => {
    e.stopPropagation()
  }
  return (
    <div
      className={styles.bar}
      data-testid="pc-bar"
      onPointerDown={swallow}
      onMouseDown={swallow}
      onClick={(e): void => e.stopPropagation()}
    >
      <button
        type="button"
        className={styles.playPause}
        data-testid="pc-playpause"
        aria-label={paused ? 'Play' : 'Pause'}
        onClick={onTogglePause}
      >
        {paused ? (
          <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
            <path d="M7 5v14l11-7z" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
            <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
          </svg>
        )}
      </button>
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        value={volume}
        className={styles.volume}
        data-testid="pc-volume"
        style={{ ['--fill' as string]: `${volume}%` } as CSSProperties}
        onChange={(e): void => onVolumeChange(Number.parseInt(e.target.value, 10))}
        aria-label="Volume"
      />
    </div>
  )
}
