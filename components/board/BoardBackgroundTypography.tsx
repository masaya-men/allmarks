'use client'

import { useEffect, useRef } from 'react'
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

export function BoardBackgroundTypography({
  activeFilter,
  moods,
  variant = 'static',
}: Props): React.ReactElement | null {
  const text = deriveBoardBgTypoText(activeFilter, moods)
  const hostRef = useRef<HTMLDivElement>(null)

  // Mouse tracker: pointermove anywhere on the document is captured (the
  // host has pointer-events: none, so it cannot receive moves of its own;
  // listening on the document and converting via host.getBoundingClientRect
  // keeps the math correct regardless of board pan or canvas transforms).
  // Writes are rAF-throttled and target two CSS custom properties on the
  // host element. Since the glitch layers fill the host exactly (inset: 0),
  // their mask-image radial-gradient coordinate space matches the host's,
  // so pixel values translate cleanly.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let rafId: number | null = null
    let pendingX = 0
    let pendingY = 0

    const flush = (): void => {
      host.style.setProperty('--bg-typo-glitch-mx', `${pendingX}px`)
      host.style.setProperty('--bg-typo-glitch-my', `${pendingY}px`)
      rafId = null
    }

    const onMove = (e: Event): void => {
      const pe = e as PointerEvent
      const rect = host.getBoundingClientRect()
      pendingX = pe.clientX - rect.left
      pendingY = pe.clientY - rect.top
      if (rafId === null) rafId = requestAnimationFrame(flush)
    }

    document.addEventListener('pointermove', onMove as EventListener)
    return (): void => {
      document.removeEventListener('pointermove', onMove as EventListener)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [])

  if (!text) return null

  return (
    <div
      ref={hostRef}
      className={styles.host}
      data-variant={variant}
      data-testid="board-bg-typography"
      aria-hidden="true"
    >
      <span className={styles.text}>{text}</span>
      <div className={styles.glitchLayer} aria-hidden="true">
        <span className={styles.glitchText + ' ' + styles.glitchTextA}>{text}</span>
      </div>
      <div className={styles.glitchLayer} aria-hidden="true">
        <span className={styles.glitchText + ' ' + styles.glitchTextB}>{text}</span>
      </div>
    </div>
  )
}
