'use client'

import { type ReactElement } from 'react'
import type { BoardItem } from '@/lib/storage/use-board-data'
import styles from './AmbientBackdrop.module.css'

export type SwipeDecision = 'yes' | 'no'

/** Apple-TV-style ambient blur of the current card's thumbnail. Sits
 *  behind everything in /triage so the bookmark's own color tone bleeds
 *  outward.
 *
 *  Session 80: continuous slide. The exit layer translates off; an
 *  incoming layer (= next card's backdrop) is mounted alongside it and
 *  slides in from the opposite edge, so the world reads as one
 *  continuous horizontal pan instead of fade-out / fade-in. */
export function AmbientBackdrop({ item, exitDecision, role = 'current', enterDirection }: {
  item: BoardItem | null
  exitDecision?: SwipeDecision | null
  role?: 'current' | 'incoming'
  enterDirection?: 'from-right' | 'from-left'
}): ReactElement {
  if (!item?.thumbnail) {
    return <div className={styles.fallback} aria-hidden="true" />
  }
  const animClass = role === 'incoming'
    ? (enterDirection === 'from-left' ? styles.enterFromLeft : styles.enterFromRight)
    : exitDecision === 'yes' ? styles.exitYes
    : exitDecision === 'no' ? styles.exitNo
    : ''
  return (
    <div
      className={`${styles.layer} ${animClass}`.trim()}
      style={{ backgroundImage: `url("${item.thumbnail.replace(/"/g, '%22')}")` }}
      aria-hidden="true"
    />
  )
}
