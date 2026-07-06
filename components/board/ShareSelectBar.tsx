'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
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
  /** Advance to the arrange stage (free-placement collage) with the current
   *  selection. Disabled at 0. (Prop name kept as onShare for call-site
   *  stability; the label now reads ARRANGE.) */
  readonly onShare: () => void
  /** Leave selection mode and discard the selection. */
  readonly onCancel: () => void
}

const CAP_FLASH_MS = 1600

export function ShareSelectBar({ count, capFlashCycle, onSelectAll, onShare, onCancel }: Props): ReactElement {
  const [capVisible, setCapVisible] = useState<boolean>(false)
  // Track the last cycle we saw so the pill flashes only on an actual bump
  // (a change), never on the initial value — mounting with an already-nonzero
  // capFlashCycle must not flash. Initialising the ref to the incoming value
  // makes the first effect run a no-op regardless of that value.
  const prevCycleRef = useRef<number>(capFlashCycle)

  useEffect((): (() => void) | undefined => {
    if (capFlashCycle === prevCycleRef.current) return undefined
    prevCycleRef.current = capFlashCycle
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
        {capVisible && <span className={styles.capPill}>{SHARE_LIMITS_V2.MAX_CARDS} MAX</span>}
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
