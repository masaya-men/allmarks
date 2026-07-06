'use client'

import { type ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import styles from './ShareToast.module.css'

type Props = {
  /** Number of cards currently in the shared collage. */
  readonly count: number
  /** Back to the first stage (card selection). */
  readonly onReselect: () => void
  /** Leave SHARE mode entirely. */
  readonly onDone: () => void
}

export function ShareToast({ count, onReselect, onDone }: Props): ReactElement {
  return (
    <div className={styles.root} style={{ zIndex: BOARD_Z_INDEX.SHARE_TOAST }} role="toolbar" aria-label="Sharing">
      <div className={styles.bar}>
        <span className={styles.counter} data-testid="share-toast-count">
          SHARING… {count}
        </span>
        <span className={styles.hint}>
          Screenshot the collage area to share（Win: Win+Shift+S / Mac: ⌘+Shift+4）
        </span>
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryBtn} onClick={onReselect} data-testid="share-toast-reselect">
            RESELECT
          </button>
          <button type="button" className={styles.primaryBtn} onClick={onDone} data-testid="share-toast-done">
            DONE
          </button>
        </div>
      </div>
    </div>
  )
}
