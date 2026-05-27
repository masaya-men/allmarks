'use client'
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import type { ShareDataV2 } from '@/lib/share/types-v2'
import styles from './SenderShareModal.module.css'
import { captureMirrorToWebP } from '@/lib/share/capture-mirror'
import { createShare } from '@/lib/share/api-client'
import { ShareMirror } from './ShareMirror'

type ModalState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'capturing' }
  | { readonly kind: 'ready'; readonly shareUrl: string }
  | { readonly kind: 'error'; readonly message: string }

type Props = {
  readonly open: boolean
  readonly onClose: () => void
  /** Lazy accessor: called when SHARE confirm pressed to build the share payload. */
  readonly getShareData: () => ShareDataV2
  /** Total cards visible in current board view (= filteredItems.length). */
  readonly totalBoardCount: number
  /** Bg board's current scrollY (= viewport.y). For mirror sync scroll. */
  readonly scrollY: number
  /** Bg board's full scrollable height (= contentBounds.height). */
  readonly contentHeight: number
  /** Bg board's viewport height (= viewport.h). */
  readonly viewportHeight: number
  /** Active filter tag names for mirror top strip. Empty = no filter. */
  readonly activeTagNames: ReadonlyArray<string>
}

export function SenderShareModal({
  open,
  onClose,
  getShareData,
  totalBoardCount,
  scrollY,
  contentHeight,
  viewportHeight,
  activeTagNames,
}: Props): ReactElement | null {
  const [state, setState] = useState<ModalState>({ kind: 'idle' })
  const [copied, setCopied] = useState<boolean>(false)
  const mirrorFrameRef = useRef<HTMLDivElement | null>(null)

  // ESC handler
  useEffect((): (() => void) | undefined => {
    if (!open) return undefined
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Reset state on close
  useEffect((): void => {
    if (!open) setState({ kind: 'idle' })
  }, [open])

  const handleBackdrop = useCallback((e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  const handleShareConfirm = useCallback(async (): Promise<void> => {
    setState({ kind: 'capturing' })
    try {
      const share = getShareData()
      const thumbDataUrl = await captureMirrorToWebP({
        mirrorFrame: mirrorFrameRef.current,
        shareData: share,
        activeTagNames,
        totalBoardCount,
        width: 1200,
        height: 628,
        quality: 0.85,
      })
      if (!thumbDataUrl) {
        setState({ kind: 'error', message: 'capture failed' })
        return
      }
      const result = await createShare({ share, thumb: thumbDataUrl })
      if (!result.ok) {
        setState({ kind: 'error', message: result.message })
        return
      }
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://allmarks.app'
      const shareUrl = `${origin}/s/${result.data.id}`
      setState({ kind: 'ready', shareUrl })
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : 'unknown error' })
    }
  }, [getShareData, activeTagNames, totalBoardCount])

  if (!open) return null

  const shareData = getShareData()

  return (
    <div className={styles.backdrop} onClick={handleBackdrop}>
      <div className={styles.panel} role="dialog" aria-label="Share board">
        <header className={styles.header}>
          <span className={styles.title}>SHARE BOARD</span>
          <button type="button" className={styles.closeIcon} onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className={styles.preview}>
          <ShareMirror
            shareData={shareData}
            activeTagNames={activeTagNames}
            totalBoardCount={totalBoardCount}
            scrollY={scrollY}
            contentHeight={contentHeight}
            viewportHeight={viewportHeight}
            frameRef={mirrorFrameRef}
          />
        </div>

        <p className={styles.hint}>
          SCROLL TO POSITION · PRESS SHARE NOW WHEN READY
        </p>

        <div className={styles.actions}>
          {state.kind === 'ready' ? (
            <>
              <div className={styles.urlRow}>
                <code className={styles.url}>{state.shareUrl}</code>
                <button
                  type="button"
                  className={styles.copyBtn}
                  onClick={(): void => {
                    void navigator.clipboard.writeText(state.shareUrl).then((): void => {
                      setCopied(true)
                      setTimeout((): void => setCopied(false), 1500)
                    })
                  }}
                >{copied ? 'COPIED' : 'COPY'}</button>
              </div>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={(): void => {
                  const intent = `https://twitter.com/intent/tweet?url=${encodeURIComponent(state.shareUrl)}`
                  window.open(intent, '_blank', 'noopener,noreferrer')
                }}
              >POST TO X</button>
            </>
          ) : state.kind === 'error' ? (
            <>
              <code className={styles.url} style={{ color: '#ff8888' }}>⚠ {state.message}</code>
              <button type="button" className={styles.primaryBtn} onClick={handleShareConfirm}>RETRY</button>
            </>
          ) : (
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={state.kind === 'capturing'}
              onClick={handleShareConfirm}
            >{state.kind === 'capturing' ? 'CAPTURING…' : 'SHARE NOW'}</button>
          )}

          <button type="button" className={styles.secondaryBtn} onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>
  )
}
