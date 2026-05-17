'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './UndoToast.module.css'

export type UndoToastInput = {
  readonly message: string
  /** Monotonic id so consecutive identical messages still re-trigger the
   *  fade-in (key on this when consuming). */
  readonly nonce: number
} | null

const VISIBLE_MS = 1500
const FADE_OUT_MS = 200

export function UndoToast({ input }: { readonly input: UndoToastInput }): ReactNode {
  const [text, setText] = useState<string>('')
  const [visible, setVisible] = useState<boolean>(false)
  const [mounted, setMounted] = useState<boolean>(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!input) return
    setText(input.message)
    setVisible(true)
    const hideTimer = setTimeout(() => setVisible(false), VISIBLE_MS)
    return () => {
      clearTimeout(hideTimer)
    }
  }, [input])

  // Keep the text mounted briefly after visible flips false so the fade-out
  // transition runs against the last message rather than going blank.
  const [renderText, setRenderText] = useState<string>('')
  useEffect(() => {
    if (visible) {
      setRenderText(text)
      return
    }
    if (!renderText) return
    const clearTimer = setTimeout(() => setRenderText(''), FADE_OUT_MS)
    return () => clearTimeout(clearTimer)
  }, [visible, text, renderText])

  if (!mounted) return null
  if (!renderText) return null

  return createPortal(
    <div
      className={`${styles.toast} ${visible ? styles.visible : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className={styles.icon} aria-hidden="true">
        ↩
      </span>
      <span>{renderText}</span>
    </div>,
    document.body,
  )
}
