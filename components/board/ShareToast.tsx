'use client'

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import { useI18n } from '@/lib/i18n/I18nProvider'
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
  /** Current title z-layer (N-74) — omitted/undefined when there's no title
   *  (TITLE toggled off), which hides the button entirely: nothing to move. */
  readonly titleLayer?: 'behind' | 'front'
  /** Flips titleLayer. Only called when titleLayer is defined. */
  readonly onToggleTitleLayer?: () => void
}

type CopyState = 'idle' | 'copied' | 'error'

/** SHARE stage 2 (arrange) action bar. One primary button — CREATE — auto-
 *  captures the arranged collage (dom-to-image via the same-origin image proxy)
 *  and mints the hosted /s link whose preview IS that image. No manual
 *  screenshot: select → arrange → create. */
export function ShareToast(props: Props): ReactElement {
  const { count, createState, onCreate, shareUrl, onCopyLink, onPostToX, onSaveImage, onReselect, onDone, titleLayer, onToggleTitleLayer } = props
  const { t } = useI18n()

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

  const copyLabel = copyState === 'copied' ? t('share.linkCopied') : copyState === 'error' ? t('share.couldntCopy') : t('share.copyLink')
  const createLabel = createState === 'creating' ? t('share.creating') : createState === 'error' ? t('share.retry') : t('share.create')

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
            <span className={styles.ready} data-testid="share-toast-ready"><span className={styles.dot} />{t('share.linkReady')}</span>
            <div className={styles.spacer} />
            {copyBtn}
            {onSaveImage && (
              <button type="button" className={styles.textBtn} onClick={onSaveImage} data-testid="share-toast-save-image">{t('share.saveImage')}</button>
            )}
            <button type="button" className={styles.textBtn} onClick={onPostToX} data-testid="share-toast-post-x">{t('share.postToX')}</button>
            <button type="button" className={styles.primaryText} onClick={onDone} data-testid="share-toast-done">{t('share.done')}</button>
          </>
        ) : (
          // ── State A: arranged, ready to auto-create ──
          <>
            <span className={styles.status} data-testid="share-toast-count">{t('share.sharingCount').replace('{count}', String(count))}</span>
            <div className={styles.spacer} />
            <button
              type="button"
              className={styles.primaryText}
              onClick={onCreate}
              disabled={createState === 'creating'}
              data-testid="share-toast-create"
            >{createLabel}</button>
            {/* Title front/back (N-74) — only when there's a title to move.
                Dedicated titleToFront/titleToBack strings (not the bare
                toFront/toBack the mobile dock uses for a selected CARD):
                user feedback was that "TO FRONT" alone doesn't say WHAT
                moves, so these spell out "title" per language. One relevant
                action shown at a time, same sibling pattern as the dock's
                per-card front/back either way. */}
            {titleLayer && onToggleTitleLayer && (
              <button type="button" className={styles.textBtn} onClick={onToggleTitleLayer} data-testid="share-toast-title-layer">
                {titleLayer === 'front' ? t('share.titleToBack') : t('share.titleToFront')}
              </button>
            )}
            <button type="button" className={styles.textBtn} onClick={onReselect} data-testid="share-toast-reselect">{t('share.chooseAgain')}</button>
            <button type="button" className={styles.textBtn} onClick={onDone} data-testid="share-toast-done">{t('share.done')}</button>
          </>
        )}
      </div>
    </div>
  )
}
