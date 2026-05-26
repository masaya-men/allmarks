'use client'

import { type ReactElement } from 'react'
import type { BoardItem } from '@/lib/storage/use-board-data'
import styles from './AmbientBackdrop.module.css'

type Direction = 'up' | 'right' | 'down' | 'left'

/** Apple-TV-style ambient blur of the current card's thumbnail. Sits
 *  behind everything in /triage so the bookmark's own color tone bleeds
 *  outward. Re-mounts on item change (= keyed by bookmarkId) so the
 *  enter animation runs naturally. exitDirection mirrors the TriageCard
 *  swipe so the backdrop "leaves with" the card. */
export function AmbientBackdrop({ item, exitDirection }: {
  item: BoardItem | null
  exitDirection?: Direction | null
}): ReactElement {
  if (!item?.thumbnail) {
    return <div className={styles.fallback} aria-hidden="true" />
  }
  const exitClass = exitDirection
    ? styles[`exit${exitDirection.charAt(0).toUpperCase()}${exitDirection.slice(1)}`] ?? ''
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
