'use client'
import { useEffect, type ReactElement } from 'react'
import styles from './BulkImportToast.module.css'

type Props = {
  readonly saved: number
  readonly skipped: number
  readonly onDismiss: () => void
  readonly autoHideMs?: number
}

export function BulkImportToast({ saved, skipped, onDismiss, autoHideMs = 4000 }: Props): ReactElement {
  useEffect((): (() => void) => {
    const t = setTimeout(onDismiss, autoHideMs)
    return (): void => clearTimeout(t)
  }, [onDismiss, autoHideMs])

  return (
    <div className={styles.toast} role="status">
      <p className={styles.primary}>{saved} CARDS SAVED</p>
      {skipped > 0 && (
        <p className={styles.secondary}>· {skipped} ALREADY SAVED</p>
      )}
    </div>
  )
}
