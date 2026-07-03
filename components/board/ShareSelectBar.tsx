'use client'

import { useEffect, useState, type ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import { SHARE_LIMITS_V2 } from '@/lib/share/types-v2'
import styles from './ShareSelectBar.module.css'

type Props = {
  /** Currently selected card count. */
  readonly count: number
  /** Monotonic counter bumped by the parent whenever an add hits the cap.
   *  Each bump flashes the amber "100 MAX" pill for ~1.6s. 0 = initial
   *  (never flash on mount — the parent resets it when entering the mode). */
  readonly capFlashCycle: number
  /** Add every visible (filtered) card up to the cap, board order. */
  readonly onSelectAll: () => void
  /** Confirm the selection and reopen the share modal. Disabled at 0. */
  readonly onShare: () => void
  /** Leave selection mode and discard the selection. */
  readonly onCancel: () => void
}

const CAP_FLASH_MS = 1600

export function ShareSelectBar({ count, capFlashCycle, onSelectAll, onShare, onCancel }: Props): ReactElement {
  const [capVisible, setCapVisible] = useState<boolean>(false)

  useEffect((): (() => void) | undefined => {
    if (capFlashCycle === 0) return undefined
    setCapVisible(true)
    const t = setTimeout((): void => setCapVisible(false), CAP_FLASH_MS)
    return (): void => clearTimeout(t)
  }, [capFlashCycle])

  return (
    <div className={styles.root} style={{ zIndex: BOARD_Z_INDEX.SHARE_SELECT_BAR }} role="toolbar" aria-label="Select cards to share">
      <div className={styles.bar}>
        <span className={styles.counter} data-testid="select-counter">
          {count} / {SHARE_LIMITS_V2.MAX_CARDS} SELECTED
        </span>
        {capVisible && <span className={styles.capPill}>100 MAX</span>}
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryBtn} onClick={onSelectAll} data-testid="select-all-button">
            SELECT ALL
          </button>
          <button type="button" className={styles.primaryBtn} onClick={onShare} disabled={count === 0} data-testid="select-share-button">
            SHARE ({count})
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={onCancel} data-testid="select-cancel-button">
            CANCEL
          </button>
        </div>
      </div>
    </div>
  )
}
