'use client'

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import styles from './TrashConfirmDialog.module.css'

const HOLD_DURATION_MS = 2000

type Props = {
  /** Number of items currently in the trash. Shown in the body line. */
  readonly count: number
  /** Fired once the user has held DELETE for the full duration. The
   *  parent runs the actual emptyTrash() and then closes the dialog. */
  readonly onConfirm: () => void
  /** Fired on CANCEL, Esc, or backdrop click. */
  readonly onCancel: () => void
}

/** Empty-trash confirmation dialog. The DELETE button requires a
 *  2-second hold to fire — short releases or pointer-leaves snap the
 *  fill bar back to zero. This guards against accidental hard-deletes
 *  without an extra modal step. */
export function TrashConfirmDialog({ count, onConfirm, onCancel }: Props): ReactElement {
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
      // Snap back to 0 with the "released" easing (longer transition).
      const el = fillRef.current
      if (el) {
        el.classList.add(styles.deleteBtnFillReleased)
        setFill(0)
        // Drop the class after the snap-back so the next hold uses the
        // tight 80ms linear feel rather than the longer release ease.
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
        // Fire once even if the rAF re-schedules before unmount.
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

  // Cleanup on unmount: stop any in-flight rAF.
  useEffect(() => {
    return (): void => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Esc to cancel + keyboard hold via Enter (sustained press triggers
  // keydown repeats; we treat the first keydown as startHold and any
  // keyup as a release).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel() }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className={styles.backdrop}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="trash-confirm-heading"
      data-testid="trash-confirm-dialog"
    >
      <div className={styles.panel} onClick={(e): void => e.stopPropagation()}>
        <div id="trash-confirm-heading" className={styles.heading}>EMPTY TRASH</div>
        <div className={styles.body}>
          Delete {count} {count === 1 ? 'item' : 'items'} forever?
        </div>
        <div className={styles.warn}>This cannot be undone.</div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onCancel}
            data-testid="trash-confirm-cancel"
          >
            CANCEL
          </button>
          <button
            type="button"
            className={styles.deleteBtn}
            data-holding={holding}
            data-testid="trash-confirm-delete"
            aria-label="Hold to delete forever"
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
