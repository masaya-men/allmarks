'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import styles from './MobileArrangeToast.module.css'

export type MobileArrangeToastProps = {
  /** Native-language confirmation text (caller passes the translated `t()`
   *  string — this component never localizes on its own). */
  readonly message: string
  /** "UNDO" button — restores the just-removed card. */
  readonly onUndo: () => void
  /** Called once the toast should go away, either from the auto-dismiss
   *  timer or (if the caller wires it) an explicit close. */
  readonly onDismiss: () => void
}

/** Confirms a card was removed from the collage IMAGE (not the saved link).
 *  Modeled on `UndoToast.tsx`: body portal + SSR-safe mount gate. Unlike
 *  UndoToast this carries its own dismiss timer, since the parent mounts it
 *  once per removal rather than feeding it a stream of messages. */
const AUTO_DISMISS_MS = 4000

export function MobileArrangeToast({ message, onUndo, onDismiss }: MobileArrangeToastProps): ReactNode {
  const [mounted, setMounted] = useState<boolean>(false)
  const [visible, setVisible] = useState<boolean>(false)

  // Keep the latest onDismiss without re-arming the timer on every parent
  // re-render (onDismiss is typically a fresh inline closure each render).
  const onDismissRef = useRef(onDismiss)
  useEffect(() => {
    onDismissRef.current = onDismiss
  }, [onDismiss])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    // Paint hidden first, then flip to visible so the CSS transition runs
    // (no-op visually under prefers-reduced-motion, since the CSS drops the
    // transition there and the pill just appears already-visible).
    const raf = requestAnimationFrame(() => setVisible(true))
    const dismissTimer = window.setTimeout(() => onDismissRef.current(), AUTO_DISMISS_MS)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(dismissTimer)
    }
  }, [])

  if (!mounted) return null

  return createPortal(
    <div
      className={styles.root}
      style={{ zIndex: BOARD_Z_INDEX.SHARE_REMOVE_TOAST }}
      data-no-capture
      data-testid="mobile-arrange-remove-toast"
    >
      <div className={`${styles.card} ${visible ? styles.visible : ''}`} role="status" aria-live="polite">
        <span className={styles.message}>{message}</span>
        <button
          type="button"
          className={styles.undo}
          onClick={onUndo}
          data-testid="mobile-arrange-remove-toast-undo"
        >
          UNDO
        </button>
      </div>
    </div>,
    document.body,
  )
}
