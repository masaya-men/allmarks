'use client'

import type { ReactElement, ReactNode } from 'react'
import styles from './TopHeader.module.css'

type Props = {
  /** Upper right row: MOTION toggle + FilterPill. */
  readonly actionsTop: ReactNode
  /** Lower right row: TUNE / POP OUT / SHARE (kept in place). */
  readonly actionsBottom: ReactNode
  /** When the Lightbox is open we fade the header out so its chrome doesn't
   *  compete with the lightbox surface, and the lightbox close button (top-
   *  right of the canvas) doesn't collide with Share/Size controls. The
   *  header keeps its slot in the canvas grid — only opacity + pointer
   *  events transition — so the cards layout below doesn't reflow. */
  readonly hidden?: boolean
}

export function TopHeader({ actionsTop, actionsBottom, hidden }: Props): ReactElement {
  const className = hidden ? `${styles.header} ${styles.hidden}` : styles.header
  return (
    <header
      className={className}
      data-testid="board-top-header"
      aria-hidden={hidden ? 'true' : undefined}
    >
      <div className={styles.rightStack}>
        <div className={styles.group} data-group="actions-top">{actionsTop}</div>
        <div className={styles.group} data-group="actions-bottom">{actionsBottom}</div>
      </div>
    </header>
  )
}
