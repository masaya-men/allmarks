'use client'
import { useCallback, useEffect, useState, type ReactElement } from 'react'
import type { ShareDataV2 } from '@/lib/share/types-v2'
import styles from './SenderShareModal.module.css'
import { captureViewportWebP } from '@/lib/share/snapshot'
import { createShare } from '@/lib/share/api-client'

type ModalState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly shareUrl: string; readonly thumbDataUrl: string }
  | { readonly kind: 'error'; readonly message: string }

type Props = {
  readonly open: boolean
  readonly onClose: () => void
  /** Lazy accessor: called once when modal opens to build the share payload. */
  readonly getShareData: () => ShareDataV2
  /** Lazy accessor: returns the HTMLElement to snapshot (= board canvas wrap). */
  readonly getCanvasElement: () => HTMLElement | null
  /** Total cards visible in current board view (= filteredItems.length).
   *  When this exceeds 100 (= SHARE_LIMITS_V2.MAX_CARDS) the modal shows the
   *  trim so the user knows only the first 100 are being shared. */
  readonly totalBoardCount: number
}

export function SenderShareModal({ open, onClose, getShareData, getCanvasElement, totalBoardCount }: Props): ReactElement | null {
  const [state, setState] = useState<ModalState>({ kind: 'loading' })
  const [copied, setCopied] = useState<boolean>(false)

  // ESC + backdrop click handlers
  useEffect((): (() => void) | undefined => {
    if (!open) return undefined
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Reset state when modal closes (so re-open starts fresh)
  useEffect((): void => {
    if (!open) setState({ kind: 'loading' })
  }, [open])

  // Snapshot + POST /api/share/create on open
  useEffect((): void => {
    if (!open) return
    void (async (): Promise<void> => {
      setState({ kind: 'loading' })
      try {
        const canvas = getCanvasElement()
        const share = getShareData()
        const cardCount = share.cards.length
        const thumb = await captureViewportWebP(canvas, {
          width: 1200,
          quality: 0.88,
          captionRight: `${cardCount} CARDS`,
        })
        const thumbDataUrl = thumb ?? 'data:image/webp;base64,'
        const result = await createShare({ share, thumb: thumbDataUrl })
        if (!result.ok) {
          setState({ kind: 'error', message: result.message })
          return
        }
        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://allmarks.app'
        const shareUrl = `${origin}/s/${result.data.id}`
        setState({ kind: 'ready', shareUrl, thumbDataUrl })
      } catch (e) {
        setState({ kind: 'error', message: e instanceof Error ? e.message : 'unknown error' })
      }
    })()
  }, [open, getShareData, getCanvasElement])

  const handleBackdrop = useCallback((e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  if (!open) return null

  const shareData = getShareData()
  const cardCount = shareData.cards.length

  return (
    <div className={styles.backdrop} onClick={handleBackdrop}>
      <div className={styles.panel} role="dialog" aria-label="Share board">
        <header className={styles.header}>
          <span className={styles.title}>SHARE BOARD</span>
          <button type="button" className={styles.closeIcon} onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className={styles.preview}>
          {state.kind === 'ready' ? (
            <img src={state.thumbDataUrl} alt="Board preview" className={styles.thumb} />
          ) : (
            <div className={styles.thumbSkeleton} />
          )}
        </div>
        <p className={styles.meta}>
          {totalBoardCount > cardCount
            ? `SHARING ${cardCount} OF ${totalBoardCount} CARDS · NEWEST FIRST`
            : `${cardCount} CARDS`}
        </p>
        <div className={styles.actions}>
          <div className={styles.urlRow}>
            {state.kind === 'ready' ? (
              <code className={styles.url}>{state.shareUrl}</code>
            ) : state.kind === 'error' ? (
              <code className={styles.url} style={{ color: '#ff8888' }}>⚠ {state.message}</code>
            ) : (
              <code className={styles.url}>⌗ preparing...</code>
            )}
            <button
              type="button"
              className={styles.copyBtn}
              disabled={state.kind !== 'ready'}
              onClick={(): void => {
                if (state.kind !== 'ready') return
                void navigator.clipboard.writeText(state.shareUrl).then((): void => {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                })
              }}
            >{copied ? 'COPIED' : 'COPY'}</button>
          </div>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={state.kind !== 'ready'}
            onClick={(): void => {
              if (state.kind !== 'ready') return
              const intent = `https://twitter.com/intent/tweet?url=${encodeURIComponent(state.shareUrl)}`
              window.open(intent, '_blank', 'noopener,noreferrer')
            }}
          >POST TO X</button>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>
  )
}
