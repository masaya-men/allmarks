'use client'

import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import styles from './ChromeDrawer.module.css'

export interface ChromeDrawerProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly title: string
  /** panel の data-testid。overlay=`${testId}-overlay` / close=`${testId}-close` を派生。 */
  readonly testId: string
  readonly children: ReactNode
  /** Close ボタンの aria-label。未指定時は英語の 'Close' 固定（呼び出し側で i18n 済み文言を渡すのが望ましい）。 */
  readonly closeLabel?: string
}

export function ChromeDrawer({ isOpen, onClose, title, testId, children, closeLabel = 'Close' }: ChromeDrawerProps): ReactElement | null {
  const panelRef = useRef<HTMLElement | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const [moreBelow, setMoreBelow] = useState(false)
  // Portal target only exists in the browser; static-export prerender has no
  // `document`, and even in the browser we must wait for mount before calling
  // createPortal (SSR-safe pattern — matches the pre-refactor ExtensionEntry drawer).
  const [mounted, setMounted] = useState(false)

  const recomputeFade = useCallback((): void => {
    const el = bodyRef.current
    if (!el) { setMoreBelow(false); return }
    setMoreBelow(el.scrollTop + el.clientHeight < el.scrollHeight - 1)
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    // `mounted` gates the portal render itself (see below) — until it flips
    // true, panelRef/closeBtnRef/bodyRef aren't attached to anything, so this
    // effect must re-run once mounted becomes true (not just on isOpen change).
    if (!isOpen || !mounted) return
    closeBtnRef.current?.focus()
    recomputeFade()
  }, [isOpen, mounted, recomputeFade])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return
    // capture phase: board が pointer capture する前に外側判定する（ThemeModal と同方式）
    const onDown = (e: PointerEvent): void => {
      if (!panelRef.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [isOpen, onClose])

  if (!isOpen || !mounted) return null

  const titleId = `${testId}-title`
  return createPortal(
    <div className={styles.overlay} role="presentation" data-testid={`${testId}-overlay`} style={{ zIndex: BOARD_Z_INDEX.CHROME_DRAWER }}>
      <aside ref={panelRef} className={styles.panel} role="dialog" aria-labelledby={titleId} data-testid={testId}>
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>{title}</h2>
          <button
            ref={closeBtnRef}
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={closeLabel}
            data-testid={`${testId}-close`}
          >×</button>
        </div>
        <div className={styles.body} ref={bodyRef} onScroll={recomputeFade}>
          {children}
        </div>
        <div className={styles.scrollFade} data-visible={moreBelow ? 'true' : 'false'} aria-hidden="true" />
      </aside>
    </div>,
    document.body
  )
}
