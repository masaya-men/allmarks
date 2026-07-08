'use client'

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import styles from './ShareToast.module.css'

export type ShareCreateState = 'idle' | 'creating' | 'error'

type Props = {
  /** Number of cards currently in the shared collage. */
  readonly count: number
  /** Create-with-auto-image state (drives the CREATE label). */
  readonly createState: ShareCreateState
  /** Auto-capture the collage → create the hosted /s link (image on R2). */
  readonly onCreate: () => void
  /** Set once a hosted link exists → switches to the "ready" actions. */
  readonly shareUrl?: string | null
  /** Copy the /s link. Resolves true on success. */
  readonly onCopyLink?: () => Promise<boolean>
  /** Open the X compose intent with the hosted link. */
  readonly onPostToX: () => void
  /** Download the captured JPEG so the user can post it natively on X. */
  readonly onSaveImage?: () => void
  /** Back to the first stage (card selection). */
  readonly onReselect: () => void
  /** Leave SHARE mode entirely. */
  readonly onDone: () => void
}

type CopyState = 'idle' | 'copied' | 'error'

/** SHARE stage 2 (arrange) action bar. One primary button — CREATE — auto-
 *  captures the arranged collage (dom-to-image via the same-origin image proxy)
 *  and mints the hosted /s link whose preview IS that image. No manual
 *  screenshot: select → arrange → create. */
export function ShareToast(props: Props): ReactElement {
  const { count, createState, onCreate, shareUrl, onCopyLink, onPostToX, onSaveImage, onReselect, onDone } = props

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

  const copyLabel = copyState === 'copied' ? 'LINK COPIED' : copyState === 'error' ? "COULDN'T COPY" : 'COPY LINK'
  const createLabel = createState === 'creating' ? 'CREATING…' : createState === 'error' ? 'RETRY' : 'CREATE'

  const copyBtn = onCopyLink && (
    <button type="button" className={styles.textBtn} onClick={(): void => { void handleCopy() }} data-testid="share-toast-copy-link">
      {copyLabel}
    </button>
  )

  return (
    <div className={styles.root} style={{ zIndex: BOARD_Z_INDEX.SHARE_TOAST }} role="toolbar" aria-label="Sharing">
      <div className={styles.bar}>
        {shareUrl ? (
          // ── State B: hosted link ready ──
          <>
            <span className={styles.ready} data-testid="share-toast-ready"><span className={styles.dot} />LINK READY</span>
            <div className={styles.spacer} />
            {copyBtn}
            {onSaveImage && (
              <button type="button" className={styles.textBtn} onClick={onSaveImage} data-testid="share-toast-save-image">SAVE IMAGE</button>
            )}
            <button type="button" className={styles.textBtn} onClick={onPostToX} data-testid="share-toast-post-x">POST TO X</button>
            <button type="button" className={styles.primaryText} onClick={onDone} data-testid="share-toast-done">DONE</button>
          </>
        ) : (
          // ── State A: arranged, ready to auto-create ──
          <>
            <span className={styles.status} data-testid="share-toast-count">SHARING · {count}</span>
            <div className={styles.spacer} />
            <button
              type="button"
              className={styles.primaryText}
              onClick={onCreate}
              disabled={createState === 'creating'}
              data-testid="share-toast-create"
            >{createLabel}</button>
            <button type="button" className={styles.textBtn} onClick={onReselect} data-testid="share-toast-reselect">RESELECT</button>
            <button type="button" className={styles.textBtn} onClick={onDone} data-testid="share-toast-done">DONE</button>
          </>
        )}
      </div>
    </div>
  )
}
