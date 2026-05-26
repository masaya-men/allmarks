'use client'

import type { CSSProperties, ReactElement } from 'react'
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
