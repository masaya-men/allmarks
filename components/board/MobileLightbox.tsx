'use client'
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { gsap } from 'gsap'
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
 *  center (the shared morph grows the tapped card into `.main`); left/right
 *  swipes slide to the prev/next card with an elastic settle, down closes, up
 *  (or the sheet handle) reveals the info sheet. Desktop keeps the two-column
 *  Lightbox frame — this mounts only under isMobile (see Lightbox.tsx). */
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
  const sheetOpenRef = useRef(false)
  sheetOpenRef.current = sheetOpen
  // 0 = not navigating; ±1 = a nav is mid-flight, tells the enter effect which
  // side the incoming card should fly in from.
  const navDirRef = useRef<-1 | 0 | 1>(0)
  const navAnimatingRef = useRef(false)

  // Enter animation: after nav.onNav swaps `view`, slide the (now new) `.main`
  // in from the side the finger was heading, with an elastic settle. Skipped on
  // the initial open (navDir 0) — the shared card→fullscreen morph owns that.
  useLayoutEffect(() => {
    const mainEl = mediaRef.current
    const dir = navDirRef.current
    if (!mainEl || dir === 0) return
    navDirRef.current = 0
    const w = window.innerWidth
    gsap.fromTo(
      mainEl,
      { x: dir * w * 1.05, scale: 0.82, opacity: 0.15, rotate: -dir * 6 },
      {
        x: 0,
        scale: 1,
        opacity: 1,
        rotate: 0,
        duration: 0.62,
        ease: 'back.out(1.5)',
        onComplete: (): void => {
          navAnimatingRef.current = false
          gsap.set(mainEl, { clearProps: 'transform,opacity' })
        },
      },
    )
  }, [view.url, mediaRef])

  const springBack = useCallback((): void => {
    const mainEl = mediaRef.current
    const stage = stageRef.current
    if (mainEl) gsap.to(mainEl, { x: 0, rotate: 0, scale: 1, duration: 0.42, ease: 'elastic.out(1, 0.6)' })
    if (stage) gsap.to(stage, { y: 0, scale: 1, duration: 0.42, ease: 'elastic.out(1, 0.6)' })
  }, [mediaRef])

  const doNav = useCallback(
    (dir: -1 | 1): void => {
      const mainEl = mediaRef.current
      if (!mainEl || !nav || navAnimatingRef.current) return
      navAnimatingRef.current = true
      navDirRef.current = dir
      const w = window.innerWidth
      // Current card is flung off in the swipe direction, tilting + shrinking
      // (the "deform as it leaves") — then onNav swaps `view` and the enter
      // effect above flies the next card in from the opposite edge.
      gsap.to(mainEl, {
        x: -dir * w * 1.05,
        scale: 0.8,
        opacity: 0.15,
        rotate: dir * 6,
        duration: 0.26,
        ease: 'power2.in',
        onComplete: (): void => nav.onNav(dir),
      })
    },
    [mediaRef, nav],
  )

  const { bind } = useLightboxSwipe({
    contentScrollable,
    atEnd: useCallback(
      () => ({
        prev: nav ? nav.currentIndex <= 0 : true,
        next: nav ? nav.currentIndex >= nav.total - 1 : true,
      }),
      [nav],
    ),
    onDrag: (axis, dx, dy): void => {
      if (navAnimatingRef.current) return
      const stage = stageRef.current
      const mainEl = mediaRef.current
      if (axis === 'horizontal' && mainEl) {
        // Follow the finger, deforming (tilt + slight shrink) toward the drag.
        gsap.set(mainEl, { x: dx, rotate: dx / 42, scale: 1 - Math.min(Math.abs(dx) / 2400, 0.1) })
      } else if (axis === 'vertical' && stage && !sheetOpenRef.current) {
        // Down follows 1:1 + shrinks (peel-to-dismiss); up is damped (the sheet
        // is the real upward affordance, not the stage).
        const shift = dy > 0 ? dy : dy * 0.3
        gsap.set(stage, { y: shift, scale: dy > 0 ? Math.max(0.9, 1 - dy / 1600) : 1 })
      }
    },
    onIntent: (intent): void => {
      if (intent === 'close') {
        // With the sheet open, a downward swipe closes the SHEET, not the card.
        if (sheetOpenRef.current) {
          setSheetOpen(false)
          springBack()
          return
        }
        // Close morph reads .main's live rect, so leaving the drag transform in
        // place lets the card keep shrinking from where the finger left it,
        // straight back into its board slot — no snap-to-center first.
        onClose()
      } else if (intent === 'next') {
        doNav(1)
      } else if (intent === 'prev') {
        doNav(-1)
      } else if (intent === 'sheet') {
        setSheetOpen(true)
        springBack()
      } else {
        // Sub-threshold release — settle back with a soft bounce.
        springBack()
      }
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
