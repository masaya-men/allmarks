'use client'

import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import styles from './ChromeDrawer.module.css'

export interface ChromeDrawerProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly title: string
  readonly testId: string
  readonly children: ReactNode
}

export function ChromeDrawer({ isOpen, onClose, title, testId, children }: ChromeDrawerProps): ReactElement | null {
  const panelRef = useRef<HTMLElement | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const [moreBelow, setMoreBelow] = useState(false)

  const recomputeFade = useCallback((): void => {
    const el = bodyRef.current
    if (!el) { setMoreBelow(false); return }
    setMoreBelow(el.scrollTop + el.clientHeight < el.scrollHeight - 1)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    closeBtnRef.current?.focus()
    recomputeFade()
  }, [isOpen, recomputeFade])

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

  if (!isOpen) return null

  const titleId = `${testId}-title`
  return (
    <div className={styles.overlay} role="presentation" data-testid={`${testId}-overlay`}>
      <aside ref={panelRef} className={styles.panel} role="dialog" aria-labelledby={titleId} data-testid={testId}>
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>{title}</h2>
          <button
            ref={closeBtnRef}
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
            data-testid={`${testId}-close`}
          >×</button>
        </div>
        <div className={styles.body} ref={bodyRef} onScroll={recomputeFade}>
          {children}
        </div>
        <div className={styles.scrollFade} data-visible={moreBelow ? 'true' : 'false'} aria-hidden="true" />
      </aside>
    </div>
  )
}
