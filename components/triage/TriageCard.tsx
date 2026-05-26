'use client'

import type { CSSProperties, ReactElement } from 'react'
import type { BoardItem } from '@/lib/storage/use-board-data'
import type { SwipeDecision } from './AmbientBackdrop'
import styles from './TriageCard.module.css'

export function TriageCard({ item, exitDecision }: {
  item: BoardItem
  exitDecision?: SwipeDecision | null
}): ReactElement {
  let host = ''
  try { host = new URL(item.url).hostname.replace(/^www\./, '') } catch { /* ignore */ }
  const exitClass = exitDecision === 'yes' ? styles.exitYes
    : exitDecision === 'no' ? styles.exitNo
    : ''
  const hasThumb = Boolean(item.thumbnail)
  const cardStyle = { ['--item-aspect' as string]: String(item.aspectRatio || 1) } as CSSProperties
  return (
    <div className={`${styles.card} ${exitClass}`.trim()} style={cardStyle} data-testid="triage-card">
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
