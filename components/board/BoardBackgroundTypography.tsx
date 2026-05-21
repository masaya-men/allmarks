'use client'

import { useEffect, useRef, useState } from 'react'
import type { BoardFilter } from '@/lib/board/types'
import type { MoodRecord } from '@/lib/storage/indexeddb'
import styles from './BoardBackgroundTypography.module.css'

/**
 * Animation variants for the board's background typography layer.
 *
 * `'static'` is the only one wired up today — others are reserved names so
 * future motion experiments can be added by extending the CSS selectors on
 * `.host[data-variant=...]` (or by introducing a JS/canvas driver) without
 * having to refactor the host component or its wire-up in BoardRoot.
 *
 * Note: as of 2026-05-21, the `'static'` variant includes a mouse-following
 * chromatic-aberration glitch (orange + cyan ghosts, chrome-matching
 * horizontal-band clip animation) within ~80 px of the cursor. The label
 * is kept for backward compatibility — it means "no large-scale motion of
 * the type body", and the cursor-local glitch is the resting behaviour.
 *
 * Reserved variants:
 *   - 'dvd-bounce' — 4-corner pong like the classic idle-DVD screensaver
 *   - 'glitch'     — full-screen じじっじじっ chromatic-aberration / RGB flicker
 *   - 'multi'      — repeated copies tiled or scattered across the canvas
 *   - 'marquee'    — endless horizontal ticker
 *   - 'card-wind'  — physical jiggle reacting to nearby card motion
 */
export type BoardBgTypoVariant =
  | 'static'
  | 'dvd-bounce'
  | 'glitch'
  | 'multi'
  | 'marquee'
  | 'card-wind'

const VALID_VARIANTS: ReadonlySet<BoardBgTypoVariant> = new Set([
  'static',
  'dvd-bounce',
  'glitch',
  'multi',
  'marquee',
  'card-wind',
])

export function isBoardBgTypoVariant(value: string): value is BoardBgTypoVariant {
  return VALID_VARIANTS.has(value as BoardBgTypoVariant)
}

/**
 * Resolve the headline string shown by the background typography layer
 * for the current filter. Special filters get a fixed label; mood filters
 * resolve via the mood id to the user-defined tag name.
 *
 * Returns an empty string when there is nothing to show (e.g. a mood id
 * the user has since deleted) — the host hides itself in that case.
 */
export function deriveBoardBgTypoText(
  filter: BoardFilter,
  moods: readonly MoodRecord[],
): string {
  switch (filter) {
    case 'all':
      return 'AllMarks'
    case 'inbox':
      return 'Inbox'
    case 'archive':
      return 'Archive'
    case 'dead':
      return 'Dead Links'
  }
  if (filter.startsWith('mood:')) {
    const id = filter.slice('mood:'.length)
    return moods.find((m) => m.id === id)?.name ?? ''
  }
  return ''
}

type Props = {
  readonly activeFilter: BoardFilter
  readonly moods: readonly MoodRecord[]
  readonly variant?: BoardBgTypoVariant
}

const BURST_DURATION_MS = 800
const SLICE_COUNT = 9

export function BoardBackgroundTypography({
  activeFilter,
  moods,
  variant = 'static',
}: Props): React.ReactElement | null {
  const text = deriveBoardBgTypoText(activeFilter, moods)
  const hostRef = useRef<HTMLDivElement>(null)
  const burstTimerRef = useRef<number | null>(null)
  const [burst, setBurst] = useState(false)

  // Mouse tracker: write CSS vars synchronously on every pointermove. Chrome
  // already raf-coalesces pointermove, so an extra rAF layer just added
  // latency. listening on the document keeps the math right regardless of
  // where the board's pan/zoom transforms live in the parent tree, since
  // host.getBoundingClientRect() returns the on-screen rect.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const onMove = (e: Event): void => {
      const pe = e as PointerEvent
      const rect = host.getBoundingClientRect()
      host.style.setProperty('--bg-typo-glitch-mx', `${pe.clientX - rect.left}px`)
      host.style.setProperty('--bg-typo-glitch-my', `${pe.clientY - rect.top}px`)
    }

    document.addEventListener('pointermove', onMove as EventListener)
    return (): void => {
      document.removeEventListener('pointermove', onMove as EventListener)
    }
  }, [])

  // Burst timer cleanup on unmount
  useEffect(() => {
    return (): void => {
      if (burstTimerRef.current !== null) {
        window.clearTimeout(burstTimerRef.current)
      }
    }
  }, [])

  const triggerBurst = (): void => {
    if (burstTimerRef.current !== null) {
      window.clearTimeout(burstTimerRef.current)
    }
    // Re-trigger: drop and re-set so the CSS animation restarts cleanly.
    setBurst(false)
    // Schedule the actual set on the next frame so React commits the false
    // value first, removing the animation, then re-applies it.
    window.requestAnimationFrame(() => {
      setBurst(true)
      burstTimerRef.current = window.setTimeout(() => {
        setBurst(false)
        burstTimerRef.current = null
      }, BURST_DURATION_MS)
    })
  }

  if (!text) return null

  return (
    <div
      ref={hostRef}
      className={styles.host + (burst ? ' ' + styles.burst : '')}
      data-variant={variant}
      data-testid="board-bg-typography"
      data-burst={burst ? 'true' : 'false'}
      aria-hidden="true"
    >
      <span
        className={styles.text}
        onClick={triggerBurst}
        data-testid="board-bg-typography-text"
      >
        {text}
      </span>
      <div className={styles.spotlightMask} aria-hidden="true">
        {Array.from({ length: SLICE_COUNT }, (_, i) => (
          <span
            key={i}
            className={`${styles.slice} ${styles['slice' + i]}`}
            aria-hidden="true"
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  )
}
