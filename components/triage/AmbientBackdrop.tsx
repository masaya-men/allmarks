'use client'

import { type ReactElement } from 'react'
import type { BoardItem } from '@/lib/storage/use-board-data'
import styles from './AmbientBackdrop.module.css'

export type SwipeDecision = 'yes' | 'no'

/** Apple-TV-style ambient blur of the current card's thumbnail. Sits
 *  behind everything in /triage so the bookmark's own color tone bleeds
 *  outward. Re-mounts on item change (= keyed by bookmarkId) so the
 *  enter animation runs naturally. exitDecision mirrors the TriageCard
 *  swipe so the backdrop "leaves with" the card in the same direction. */
export function AmbientBackdrop({ item, exitDecision }: {
  item: BoardItem | null
  exitDecision?: SwipeDecision | null
}): ReactElement {
  if (!item?.thumbnail) {
    return <div className={styles.fallback} aria-hidden="true" />
  }
  const exitClass = exitDecision === 'yes' ? styles.exitYes
    : exitDecision === 'no' ? styles.exitNo
    : ''
  return (
    <div
      key={item.bookmarkId}
      className={`${styles.layer} ${exitClass}`.trim()}
      style={{ backgroundImage: `url("${item.thumbnail.replace(/"/g, '%22')}")` }}
      aria-hidden="true"
    />
  )
}
