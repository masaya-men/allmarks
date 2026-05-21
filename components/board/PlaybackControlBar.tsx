'use client'

import { type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react'
import styles from './PlaybackControlBar.module.css'

type Props = {
  /** 0–100. Per-card ephemeral volume. */
  readonly volume: number
  readonly paused: boolean
  readonly onVolumeChange: (next: number) => void
  readonly onTogglePause: () => void
  /** Hover-reveal: the bar pops out of the card while the pointer is over the
   *  card OR the bar itself, and tucks back when it leaves. Defaults to true
   *  for standalone use. */
  readonly visible?: boolean
}

/**
 * AllMarks audio-mixer styled control bar for the single active inline card.
 * Anchored attached to the card's bottom (see CardsLayer); pops in on hover.
 * Fixed comfortable size so it stays operable even when the card is small.
 * Volume is per-card and ephemeral (see BoardRoot). stopPropagation on
 * pointer/click keeps the card's reorder-drag / open-lightbox gesture from
 * firing.
 *
 * Theming: every colour/surface token is a CSS custom property declared on
 * `.bar` (see the module CSS). A theme can override `--pc-*` to restyle — or
 * later swap this whole component — without touching the markup.
 */
export function PlaybackControlBar({
  volume,
  paused,
  onVolumeChange,
  onTogglePause,
  visible = true,
}: Props): ReactElement {
  const swallow = (e: ReactPointerEvent<HTMLDivElement>): void => {
    e.stopPropagation()
  }
  return (
    <div
      className={styles.bar}
      data-testid="pc-bar"
      data-visible={visible ? 'true' : 'false'}
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
      <span className={styles.sliderWrap}>
        {/* Recessed groove + green fill are our OWN clipped elements (the
            native range track-gradient leaked an accent sliver at the right
            end). The groove clips the fill, so the level can never bleed. */}
        <span className={styles.groove} aria-hidden="true">
          <span className={styles.fill} style={{ width: `${volume}%` } as CSSProperties} />
        </span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={volume}
          className={styles.volume}
          data-testid="pc-volume"
          onChange={(e): void => onVolumeChange(Number.parseInt(e.target.value, 10))}
          aria-label="Volume"
        />
      </span>
    </div>
  )
}
