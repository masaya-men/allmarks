'use client'

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import styles from './ShareToast.module.css'

export type ShareCreateState = 'idle' | 'creating' | 'error'

type Props = {
  /** Number of cards currently in the shared collage. */
  readonly count: number
  /** OS-aware, localized one-line screenshot instruction. */
  readonly hint: string
  /** True once the user has pasted/dropped a screenshot (normalized). */
  readonly hasImage: boolean
  /** Normalized JPEG data-URL for the small confirmation thumbnail. */
  readonly imagePreviewUrl?: string | null
  /** Open the file picker (fallback to paste/drop). */
  readonly onPickFile: () => void
  /** Discard the attached screenshot. */
  readonly onClearImage: () => void
  /** Hide just THIS bar so the user can take a clean screenshot. */
  readonly onHideForSnip: () => void
  /** Create-with-image state (drives the CREATE LINK label). */
  readonly createState: ShareCreateState
  /** Create the hosted /s link using the attached screenshot. */
  readonly onCreate: () => void
  /** Set once a hosted link exists → switches to the "ready" actions. */
  readonly shareUrl?: string | null
  /** Copy the /s link. Resolves true on success. */
  readonly onCopyLink?: () => Promise<boolean>
  /** Open the X compose intent with the hosted link. */
  readonly onPostToX: () => void
  /** Back to the first stage (card selection). */
  readonly onReselect: () => void
  /** Leave SHARE mode entirely. */
  readonly onDone: () => void
}

/** Transient hint shown while the arrange bar is hidden for a clean screenshot.
 *  Auto-fades (CSS) so it is not in the shot; click/paste/timeout restores the bar. */
export function ShareSnipHint(): ReactElement {
  return (
    <div className={styles.snipAwayHint} data-testid="share-snip-hint">
      Snip now · click or paste to bring the bar back
    </div>
  )
}

type CopyState = 'idle' | 'copied' | 'error'

export function ShareToast(props: Props): ReactElement {
  const {
    count, hint, hasImage, imagePreviewUrl, onPickFile, onClearImage, onHideForSnip,
    createState, onCreate, shareUrl, onCopyLink, onPostToX, onReselect, onDone,
  } = props

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
  const createLabel = createState === 'creating' ? 'CREATING…' : createState === 'error' ? 'RETRY' : 'CREATE LINK'

  const copyBtn = onCopyLink && (
    <button type="button" className={styles.textBtn} onClick={(): void => { void handleCopy() }} data-testid="share-toast-copy-link">
      {copyLabel}
    </button>
  )

  return (
    <div className={styles.root} style={{ zIndex: BOARD_Z_INDEX.SHARE_TOAST }} role="toolbar" aria-label="Sharing">
      <div className={styles.bar}>
        {shareUrl ? (
          // ── State C: hosted link ready ──
          <>
            <span className={styles.ready} data-testid="share-toast-ready"><span className={styles.dot} />LINK READY</span>
            <div className={styles.spacer} />
            {copyBtn}
            <button type="button" className={styles.textBtn} onClick={onPostToX} data-testid="share-toast-post-x">POST TO X</button>
            <button type="button" className={styles.primaryText} onClick={onDone} data-testid="share-toast-done">DONE</button>
          </>
        ) : hasImage ? (
          // ── State B: screenshot attached, not yet created ──
          <>
            <span className={styles.status} data-testid="share-toast-count">SHOT READY</span>
            {imagePreviewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.shotThumb} src={imagePreviewUrl} alt="Your screenshot" data-testid="share-toast-shot-thumb" />
            )}
            <button type="button" className={styles.clearBtn} onClick={onClearImage} aria-label="Remove screenshot" data-testid="share-toast-shot-clear">×</button>
            <div className={styles.spacer} />
            <button type="button" className={styles.primaryText} onClick={onCreate} disabled={createState === 'creating'} data-testid="share-toast-create">{createLabel}</button>
            <button type="button" className={styles.textBtn} onClick={onReselect} data-testid="share-toast-reselect">RESELECT</button>
            <button type="button" className={styles.textBtn} onClick={onDone} data-testid="share-toast-done">DONE</button>
          </>
        ) : (
          // ── State A: before a screenshot is attached ──
          <>
            <span className={styles.status} data-testid="share-toast-count">SHARING · {count}</span>
            <span className={styles.hint}>{hint}</span>
            <div className={styles.spacer} />
            <button type="button" className={styles.snipBtn} onClick={onHideForSnip} data-testid="share-toast-hide">HIDE TO SNIP</button>
            <button type="button" className={styles.textBtn} onClick={onPickFile} data-testid="share-toast-paste">BROWSE</button>
            {copyBtn}
            <button type="button" className={styles.textBtn} onClick={onReselect} data-testid="share-toast-reselect">RESELECT</button>
            <button type="button" className={styles.primaryText} onClick={onDone} data-testid="share-toast-done">DONE</button>
          </>
        )}
      </div>
    </div>
  )
}
