'use client'

import type { ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import { SHARE_LIMITS_V2 } from '@/lib/share/types-v2'
import styles from './MobileShareSelectBar.module.css'

type Props = {
  /** Currently selected card count. */
  readonly count: number
  /** Add every visible (filtered) card up to the cap, board order. */
  readonly onSelectAll: () => void
  /** Auto-arrange into the capture band, shoot it, mint the hosted /s link. */
  readonly onCreate: () => void
  /** Leave selection mode and discard the selection. */
  readonly onCancel: () => void
}

/** SHARE stage 1 on phones (≤640px). Two rows, because 390px cannot hold three
 *  52px buttons side by side. Same chrome material as BoardMobileNav /
 *  ReceiverImportBar so the board's touch surfaces read as one system. Phones
 *  never see the arrange stage, so CREATE — not ARRANGE — is the primary. */
export function MobileShareSelectBar({ count, onSelectAll, onCreate, onCancel }: Props): ReactElement {
  return (
    <div
      className={styles.bar}
      style={{ zIndex: BOARD_Z_INDEX.SHARE_SELECT_BAR }}
      role="toolbar"
      aria-label="Select cards to share"
      data-testid="mobile-share-select-bar"
      data-no-capture
    >
      <div className={styles.meta}>
        <span className={styles.counter} data-testid="mobile-select-counter">
          {count} / {SHARE_LIMITS_V2.MAX_CARDS} SELECTED
        </span>
        <button type="button" className={styles.textBtn} onClick={onSelectAll} data-testid="mobile-select-all">
          SELECT ALL
        </button>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={onCancel} data-testid="mobile-select-cancel">
          CANCEL
        </button>
        <button
          type="button"
          className={styles.primary}
          onClick={onCreate}
          disabled={count === 0}
          data-testid="mobile-select-create"
        >
          CREATE ({count})
        </button>
      </div>
    </div>
  )
}
