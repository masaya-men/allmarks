'use client'

import type { ReactElement } from 'react'
import type { BoardItem } from '@/lib/storage/use-board-data'
import styles from './TriageCard.module.css'

type Direction = 'up' | 'right' | 'down' | 'left'

export function TriageCard({ item, exitDirection }: {
  item: BoardItem
  exitDirection?: Direction | null
}): ReactElement {
  let host = ''
  try { host = new URL(item.url).hostname.replace(/^www\./, '') } catch { /* ignore */ }
  const exitClass = exitDirection
    ? styles[`exit${exitDirection.charAt(0).toUpperCase()}${exitDirection.slice(1)}`] ?? ''
    : ''
  const hasThumb = Boolean(item.thumbnail)
  return (
    <div
      className={`${styles.card} ${hasThumb ? '' : styles.cardTextOnly} ${exitClass}`.trim()}
      data-testid="triage-card"
    >
      {hasThumb ? (
        <div
          className={styles.thumbnail}
          style={{ backgroundImage: `url("${item.thumbnail!.replace(/"/g, '%22')}")` }}
        />
      ) : (
        <div className={styles.hostnamePanel}>{host || 'link'}</div>
      )}
      <div className={styles.body}>
        <div className={styles.title}>{item.title}</div>
        {item.description && <div className={styles.description}>{item.description}</div>}
        <div className={styles.meta}><span>{host}</span></div>
      </div>
    </div>
  )
}
