'use client'

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import styles from './ShareToast.module.css'

type Props = {
  /** Number of cards currently in the shared collage. */
  readonly count: number
  /** OS-aware one-line screenshot instruction (from pickScreenshotHint). */
  readonly hint: string
  /** Copy the /s link for the current selection. Resolves true on success.
   *  Omitted → the COPY LINK button is not rendered. */
  readonly onCopyLink?: () => Promise<boolean>
  /** Back to the first stage (card selection). */
  readonly onReselect: () => void
  /** Leave SHARE mode entirely. */
  readonly onDone: () => void
}

type CopyState = 'idle' | 'copied' | 'error'

export function ShareToast({ count, hint, onCopyLink, onReselect, onDone }: Props): ReactElement {
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const timerRef = useRef<number | null>(null)
  useEffect((): (() => void) => (): void => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
  }, [])

  const handleCopy = useCallback(async (): Promise<void> => {
    if (!onCopyLink) return
    const ok = await onCopyLink()
    setCopyState(ok ? 'copied' : 'error')
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout((): void => setCopyState('idle'), 1600)
  }, [onCopyLink])

  const copyLabel = copyState === 'copied' ? 'LINK COPIED ✓' : copyState === 'error' ? "COULDN'T COPY" : 'COPY LINK'

  return (
    <div className={styles.root} style={{ zIndex: BOARD_Z_INDEX.SHARE_TOAST }} role="toolbar" aria-label="Sharing">
      <div className={styles.bar}>
        <span className={styles.counter} data-testid="share-toast-count">
          SHARING… {count}
        </span>
        <span className={styles.hint}>{hint}</span>
        <div className={styles.actions}>
          {onCopyLink && (
            <button type="button" className={styles.secondaryBtn} onClick={(): void => { void handleCopy() }} data-testid="share-toast-copy-link">
              {copyLabel}
            </button>
          )}
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
