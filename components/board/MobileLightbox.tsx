'use client'
import { useCallback, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useLightboxSwipe } from './use-lightbox-swipe'
import { LightboxInfoSheet } from './LightboxInfoSheet'
import type { LightboxItem } from '@/lib/share/lightbox-item'
import type { LightboxNav } from './lightbox-nav-types'
import styles from './MobileLightbox.module.css'

type MobileLightboxProps = {
  readonly view: LightboxItem
  /** Morph target: the big-center wrapper the desktop attaches to `.media`.
   *  On mobile the same ref lands on `.main`, so the existing open/close
   *  morph in Lightbox.tsx grows the card into it unchanged. */
  readonly mediaRef: RefObject<HTMLDivElement | null>
  /** The big-center primary content (image / video / tweet body / large text). */
  readonly main: ReactNode
  /** Secondary info for the bottom sheet. */
  readonly sheet: ReactNode
  readonly nav: LightboxNav | null
  readonly onClose: () => void
  /** Reports whether the main content can still scroll up/down, so a vertical
   *  drag defers to inner scroll before close/sheet engage. */
  readonly contentScrollable?: () => { top: boolean; bottom: boolean }
}

/** Immersive, full-screen mobile lightbox (session 180). Tap opens it big in the
 *  center; left/right swipes navigate, down closes, up (or the sheet handle)
 *  reveals the info sheet. Desktop keeps the two-column Lightbox frame — this
 *  mounts only under isMobile (see Lightbox.tsx). */
export function MobileLightbox({
  view,
  mediaRef,
  main,
  sheet,
  nav,
  onClose,
  contentScrollable,
}: MobileLightboxProps): ReactNode {
  const stageRef = useRef<HTMLDivElement>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const atEnd = useCallback(
    () => ({
      prev: nav ? nav.currentIndex <= 0 : true,
      next: nav ? nav.currentIndex >= nav.total - 1 : true,
    }),
    [nav],
  )

  const { bind } = useLightboxSwipe({
    contentScrollable,
    atEnd,
    onDrag: (axis, dx, dy): void => {
      const stage = stageRef.current
      const mainEl = mediaRef.current
      if (axis === 'vertical' && stage) {
        // Down follows 1:1; up is damped because the sheet, not the main, is
        // the upward affordance.
        const shift = dy > 0 ? dy : dy * 0.35
        stage.style.transform = `translateY(${shift}px) scale(${Math.max(0.9, 1 - Math.abs(dy) / 1600)})`
      } else if (axis === 'horizontal' && mainEl) {
        mainEl.style.transform = `translateX(${dx}px)`
      } else if (axis === 'none') {
        if (stage) stage.style.transform = ''
        if (mainEl) mainEl.style.transform = ''
      }
    },
    onIntent: (intent): void => {
      const stage = stageRef.current
      const mainEl = mediaRef.current
      if (stage) stage.style.transform = ''
      if (mainEl) mainEl.style.transform = ''
      if (intent === 'close') onClose()
      else if (intent === 'next') nav?.onNav(1)
      else if (intent === 'prev') nav?.onNav(-1)
      else if (intent === 'sheet') setSheetOpen(true)
    },
  })

  return (
    <div
      ref={stageRef}
      className={styles.stage}
      data-testid="mobile-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={view.title || 'Bookmark'}
      onClick={(e): void => {
        if (e.target === stageRef.current) onClose()
      }}
      {...bind}
    >
      <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
        <span aria-hidden="true">✕</span>
      </button>
      <div ref={mediaRef} className={styles.main} onClick={(e): void => e.stopPropagation()}>
        {main}
      </div>
      <LightboxInfoSheet open={sheetOpen} onToggle={(): void => setSheetOpen((v) => !v)}>
        {sheet}
      </LightboxInfoSheet>
    </div>
  )
}
