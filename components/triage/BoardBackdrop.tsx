'use client'

import { useMemo, type ReactElement } from 'react'
import { useBoardData } from '@/lib/storage/use-board-data'
import styles from './BoardBackdrop.module.css'

/**
 * Lightweight backdrop board rendered behind the /triage UI (= session 69
 * user proposal preserved in IDEAS.md). Mirrors enough of the board's
 * texture — thumbnails in a loose grid — to give the user "my world is
 * still right there" while they swipe. Deliberately NOT a BoardRoot mount:
 * - no GSAP, no Lightbox, no PiP, no interaction
 * - thumbnails only, motion off
 * - capped at 60 cards so off-screen IDB does not balloon DOM
 *
 * Sized + dimmed + blurred by CSS so this component stays purely about data.
 */
export function BoardBackdrop(): ReactElement | null {
  const { items, loading } = useBoardData()
  const cards = useMemo(
    () => items.filter((it) => !it.isDeleted && it.thumbnail).slice(0, 60),
    [items],
  )
  if (loading) return null
  return (
    <div className={styles.root} aria-hidden="true" data-testid="triage-backdrop">
      {cards.map((it) => (
        <div key={it.bookmarkId} className={styles.card}>
          <div
            className={styles.thumb}
            style={{ backgroundImage: `url("${(it.thumbnail ?? '').replace(/"/g, '%22')}")` }}
          />
        </div>
      ))}
    </div>
  )
}
