'use client'

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import styles from './TagDeleteConfirmDialog.module.css'

const HOLD_DURATION_MS = 2000

type Props = {
  /** Tag name shown in the heading + body. */
  readonly tagName: string
  /** Number of bookmarks currently attached to the tag. Shown in the
   *  body so the user understands the cascade. */
  readonly bookmarkCount: number
  /** Fired once the user has held DELETE for the full duration. The
   *  parent runs the actual deleteTagCascade and closes the dialog. */
  readonly onConfirm: () => void
  /** Fired on CANCEL, Esc, or backdrop click. */
  readonly onCancel: () => void
}

/** Hold-to-delete confirmation for a single tag. Mirrors the
 *  TrashConfirmDialog rAF-driven fill mechanic (= 2-second hold, snap
 *  back on early release, single-fire) so the destructive gesture
 *  feels identical across the app. Wording calls out the bookmark
 *  cascade so the user knows N bookmarks will be detached. */
export function TagDeleteConfirmDialog({
  tagName, bookmarkCount, onConfirm, onCancel,
}: Props): ReactElement {
  const [holding, setHolding] = useState(false)
  const fillRef = useRef<HTMLSpanElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const holdStartRef = useRef<number | null>(null)
  const firedRef = useRef(false)

  const setFill = (p: number): void => {
    const el = fillRef.current
    if (!el) return
    el.style.setProperty('--p', String(p))
  }

  const cancelHold = useCallback((reachedEnd: boolean): void => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    holdStartRef.current = null
    setHolding(false)
    if (!reachedEnd) {
      const el = fillRef.current
      if (el) {
        el.classList.add(styles.deleteBtnFillReleased)
        setFill(0)
        window.setTimeout(() => {
          el.classList.remove(styles.deleteBtnFillReleased)
        }, 250)
      }
    }
  }, [])

  const tick = useCallback(
    (now: number): void => {
      const start = holdStartRef.current
      if (start == null) return
      const elapsed = now - start
      const p = Math.min(1, elapsed / HOLD_DURATION_MS)
      setFill(p)
      if (p >= 1) {
        if (firedRef.current) return
        firedRef.current = true
        cancelHold(true)
        onConfirm()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    },
    [cancelHold, onConfirm],
  )

  const startHold = useCallback((): void => {
    if (firedRef.current) return
    if (holdStartRef.current != null) return
    holdStartRef.current = performance.now()
    setHolding(true)
    rafRef.current = requestAnimationFrame(tick)
  }, [tick])

  useEffect(() => {
    return (): void => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel() }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const bookmarkPhrase =
    bookmarkCount === 0
      ? 'This tag has no bookmarks.'
      : `Detach from ${bookmarkCount} ${bookmarkCount === 1 ? 'bookmark' : 'bookmarks'} and remove this tag forever?`

  return (
    <div
      className={styles.backdrop}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tag-delete-heading"
      data-testid="tag-delete-confirm-dialog"
    >
      <div className={styles.panel} onClick={(e): void => e.stopPropagation()}>
        <div id="tag-delete-heading" className={styles.heading}>DELETE TAG</div>
        <div className={styles.tagName}>{tagName}</div>
        <div className={styles.body}>{bookmarkPhrase}</div>
        {bookmarkCount > 0 && (
          <div className={styles.assure}>
            The bookmarks themselves stay — only the tag is removed.
          </div>
        )}
        <div className={styles.warn}>This cannot be undone.</div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onCancel}
            data-testid="tag-delete-cancel"
          >
            CANCEL
          </button>
          <button
            type="button"
            className={styles.deleteBtn}
            data-holding={holding}
            data-testid="tag-delete-confirm"
            aria-label="Hold to delete this tag forever"
            onPointerDown={(e): void => {
              e.currentTarget.setPointerCapture(e.pointerId)
              startHold()
            }}
            onPointerUp={(): void => cancelHold(false)}
            onPointerCancel={(): void => cancelHold(false)}
            onPointerLeave={(): void => cancelHold(false)}
          >
            <span ref={fillRef} className={styles.deleteBtnFill} aria-hidden="true" />
            <span className={styles.deleteBtnLabel} />
          </button>
        </div>
      </div>
    </div>
  )
}
