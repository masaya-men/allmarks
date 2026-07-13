'use client'

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import { canWebShareFiles, dataUrlToFile } from '@/lib/share/share-actions'
import { formatCaptureAttempts, type CaptureAttempt } from '@/lib/share/capture-collage'
import type { ShareCreateState } from './ShareToast'
import styles from './MobileShareResult.module.css'

const FILENAME = 'allmarks-collage.jpg'

export type MobileShareResultProps = {
  /** The captured 1080×1350 portrait JPEG data-URL, or null when the capture failed. */
  readonly imageUrl: string | null
  /** The hosted /s link, or null while the create is still failing. */
  readonly shareUrl: string | null
  /** 'error' switches the sheet to RETRY / DONE. */
  readonly createState: ShareCreateState
  /** Copy the /s link. Resolves true on success. */
  readonly onCopyLink: () => Promise<boolean>
  /** Re-run capture + create after a failure. */
  readonly onRetry: () => void
  /** Leave SHARE mode entirely. */
  readonly onDone: () => void
  /** 撮影の試行記録（診断表示用・N-56）。 */
  readonly captureAttempts?: readonly CaptureAttempt[] | null
  /** リンク作成が失敗した時の理由（診断表示用・N-56）。 */
  readonly errorMessage?: string | null
}

type CopyState = 'idle' | 'copied' | 'error'

/** True when this browser exposes Web Share at all. Read at render (not module
 *  scope) so a test can install it after import. */
function hasWebShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

/** SHARE stage 2 on phones: no arrange, no free placement — just the picture we
 *  are about to publish, and the one tap that publishes it. Web Share hands the
 *  OS sheet both the image file and the link, so X / Instagram / LINE all appear
 *  without us building a button for each. Platforms that refuse files still get
 *  the link; platforms without Web Share fall back to COPY LINK. */
export function MobileShareResult(props: MobileShareResultProps): ReactElement {
  const { imageUrl, shareUrl, createState, onCopyLink, onRetry, onDone, captureAttempts, errorMessage } = props

  const [copyState, setCopyState] = useState<CopyState>('idle')
  const timerRef = useRef<number | null>(null)
  useEffect((): (() => void) => (): void => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
  }, [])

  const handleCopy = useCallback(async (): Promise<void> => {
    const ok = await onCopyLink()
    setCopyState(ok ? 'copied' : 'error')
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout((): void => setCopyState('idle'), 1600)
  }, [onCopyLink])

  const handleNativeShare = useCallback(async (): Promise<void> => {
    if (!shareUrl || !hasWebShare()) return
    const file = imageUrl ? dataUrlToFile(imageUrl, FILENAME) : null
    try {
      if (file && canWebShareFiles(navigator, file)) {
        await navigator.share({ files: [file], url: shareUrl })
      } else {
        await navigator.share({ url: shareUrl })
      }
    } catch {
      // AbortError (the user dismissed the OS sheet) and every other failure are
      // silent: the link is already made and COPY LINK is right there.
    }
  }, [imageUrl, shareUrl])

  const failed = createState === 'error'

  return (
    <div
      className={styles.sheet}
      style={{ zIndex: BOARD_Z_INDEX.SHARE_TOAST }}
      role="dialog"
      aria-label="Your collage link"
      data-testid="mobile-share-result"
    >
      {failed ? (
        <>
          <span className={styles.error} data-testid="mobile-share-error">COULDN&apos;T CREATE THE LINK</span>
          {errorMessage && (
            <code className={styles.diag} data-testid="mobile-share-error-detail">{errorMessage}</code>
          )}
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={onRetry} data-testid="mobile-share-retry">RETRY</button>
            <button type="button" className={styles.ghost} onClick={onDone} data-testid="mobile-share-done">DONE</button>
          </div>
        </>
      ) : (
        <>
          {imageUrl && (
            /* eslint-disable-next-line @next/next/no-img-element -- a data-URL, not a remote asset */
            <img className={styles.preview} src={imageUrl} alt="Your collage" data-testid="mobile-share-preview" />
          )}
          {!imageUrl && (
            <div className={styles.imageFailed} data-testid="mobile-share-image-failed">
              <span className={styles.imageFailedTitle}>NO IMAGE — LINK ONLY</span>
              <span className={styles.imageFailedBody}>
                The picture could not be made on this phone. The link below still works.
              </span>
              {captureAttempts && captureAttempts.length > 0 && (
                <code className={styles.diag} data-testid="mobile-share-diag">
                  {formatCaptureAttempts(captureAttempts)}
                </code>
              )}
              <button
                type="button"
                className={styles.secondary}
                onClick={onRetry}
                data-testid="mobile-share-retry-image"
              >RETRY IMAGE</button>
            </div>
          )}
          {imageUrl && captureAttempts && captureAttempts.length > 1 && (
            <code className={styles.diag} data-testid="mobile-share-diag">
              {formatCaptureAttempts(captureAttempts)}
            </code>
          )}
          <span className={styles.status} data-testid="mobile-share-ready">
            <span className={styles.dot} />LINK READY
          </span>
          <div className={styles.actions}>
            {hasWebShare() && (
              <button
                type="button"
                className={styles.primary}
                onClick={(): void => { void handleNativeShare() }}
                data-testid="mobile-share-native"
              >SHARE</button>
            )}
            <button
              type="button"
              className={styles.secondary}
              onClick={(): void => { void handleCopy() }}
              data-testid="mobile-share-copy"
            >
              {copyState === 'copied' ? 'LINK COPIED' : copyState === 'error' ? "COULDN'T COPY" : 'COPY LINK'}
            </button>
            <button type="button" className={styles.ghost} onClick={onDone} data-testid="mobile-share-done">DONE</button>
          </div>
        </>
      )}
    </div>
  )
}
