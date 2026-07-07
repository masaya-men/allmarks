'use client'

import { type ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import { SHARE_LIMITS_V2 } from '@/lib/share/types-v2'
import styles from './ShareSelectBar.module.css'

type Props = {
  /** Currently selected card count. */
  readonly count: number
  /** Add every visible (filtered) card up to the cap, board order. */
  readonly onSelectAll: () => void
  /** Advance to the arrange stage (free-placement collage) with the current
   *  selection. Disabled at 0. (Prop name kept as onShare for call-site
   *  stability; the label now reads ARRANGE.) */
  readonly onShare: () => void
  /** Leave selection mode and discard the selection. */
  readonly onCancel: () => void
}

export function ShareSelectBar({ count, onSelectAll, onShare, onCancel }: Props): ReactElement {
  return (
    <div className={styles.root} style={{ zIndex: BOARD_Z_INDEX.SHARE_SELECT_BAR }} role="toolbar" aria-label="Select cards to share">
      <div className={styles.bar}>
        <span className={styles.counter} data-testid="select-counter">
          {count} / {SHARE_LIMITS_V2.MAX_CARDS} SELECTED
        </span>
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryBtn} onClick={onSelectAll} data-testid="select-all-button">
            SELECT ALL
          </button>
          <button type="button" className={styles.primaryBtn} onClick={onShare} disabled={count === 0} data-testid="select-share-button">
            ARRANGE ({count})
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={onCancel} data-testid="select-cancel-button">
            CANCEL
          </button>
        </div>
      </div>
    </div>
  )
}
