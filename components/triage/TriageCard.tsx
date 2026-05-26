'use client'

import type { CSSProperties, ReactElement } from 'react'
import type { BoardItem } from '@/lib/storage/use-board-data'
import type { SwipeDecision } from './AmbientBackdrop'
import styles from './TriageCard.module.css'

/** role:
 *   - 'current'  = card that is on screen and may exit
 *   - 'incoming' = card sliding in from the opposite side of the swipe
 *  enterDirection is required for 'incoming' so we know which edge to
 *  enter from. For 'current' it's ignored.
 */
export function TriageCard({ item, exitDecision, role = 'current', enterDirection }: {
  item: BoardItem
  exitDecision?: SwipeDecision | null
  role?: 'current' | 'incoming'
  enterDirection?: 'from-right' | 'from-left'
}): ReactElement {
  let host = ''
  try { host = new URL(item.url).hostname.replace(/^www\./, '') } catch { /* ignore */ }

  const animClass = role === 'incoming'
    ? (enterDirection === 'from-left' ? styles.enterFromLeft : styles.enterFromRight)
    : exitDecision === 'yes' ? styles.exitYes
    : exitDecision === 'no' ? styles.exitNo
    : ''

  const hasThumb = Boolean(item.thumbnail)
  const cardStyle = { ['--item-aspect' as string]: String(item.aspectRatio || 1) } as CSSProperties
  return (
    <div className={`${styles.card} ${animClass}`.trim()} style={cardStyle} data-testid="triage-card">
      {hasThumb ? (
        <div
          className={styles.media}
          style={{ backgroundImage: `url("${item.thumbnail!.replace(/"/g, '%22')}")` }}
        />
      ) : (
        <div className={styles.hostnamePanel}>{host || 'link'}</div>
      )}
      <div className={styles.text}>
        <h1 className={styles.title}>{item.title}</h1>
        {item.description && <p className={styles.description}>{item.description}</p>}
        <div className={styles.meta}><span>{host}</span></div>
      </div>
    </div>
  )
}
