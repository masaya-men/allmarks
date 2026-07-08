'use client'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
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

// A hard flick advances more cards, decelerating — like the board's inertial
// scroll. speed is px/ms; every ~1.5 px/ms of release velocity buys one extra
// card, capped so a violent flick can't spin forever.
const FLICK_CARD_DIVISOR = 1.5
const FLICK_MAX_CARDS = 5

/** Immersive, full-screen mobile lightbox (session 180). Tap opens it big in the
 *  center (the shared morph grows the tapped card into `.main`); left/right
 *  swipes slide to the prev/next card — a hard flick coasts through several with
 *  decelerating inertia — down closes, up (or the sheet handle) reveals the info
 *  sheet. Desktop keeps the two-column Lightbox frame. */
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
  // Direction the incoming card should fly in from (0 = not navigating).
  const navDirRef = useRef<-1 | 0 | 1>(0)
  const navAnimatingRef = useRef(false)
  // Multi-card inertial flick: how many more onNav steps to fire, decelerating.
  const flickRef = useRef<{ dir: -1 | 1; remaining: number; total: number } | null>(null)
  const flickTimerRef = useRef<number | null>(null)

  useEffect(
    () => (): void => {
      if (flickTimerRef.current !== null) window.clearTimeout(flickTimerRef.current)
    },
    [],
  )

  // Enter animation after each onNav swaps `view`. Intermediate cards in a flick
  // slide in quick + flat; the last one settles with an elastic overshoot.
  useLayoutEffect(() => {
    const mainEl = mediaRef.current
    const dir = navDirRef.current
    if (!mainEl || dir === 0) return
    navDirRef.current = 0
    const last = !flickRef.current || flickRef.current.remaining <= 0
    const w = window.innerWidth
    gsap.fromTo(
      mainEl,
      { x: dir * w * (last ? 1.05 : 0.7), scale: last ? 0.82 : 0.94, opacity: last ? 0.15 : 0.5, rotate: -dir * (last ? 6 : 2) },
      {
        x: 0,
        scale: 1,
        opacity: 1,
        rotate: 0,
        duration: last ? 0.6 : 0.16,
        ease: last ? 'back.out(1.5)' : 'power1.out',
        onComplete: last
          ? (): void => {
              navAnimatingRef.current = false
              gsap.set(mainEl, { clearProps: 'transform,opacity' })
            }
          : undefined,
      },
    )
  }, [view.url, mediaRef])

  const springBack = useCallback((): void => {
    const mainEl = mediaRef.current
    const stage = stageRef.current
    if (mainEl) gsap.to(mainEl, { x: 0, rotate: 0, scale: 1, duration: 0.42, ease: 'elastic.out(1, 0.6)' })
    if (stage) gsap.to(stage, { y: 0, scale: 1, duration: 0.42, ease: 'elastic.out(1, 0.6)' })
  }, [mediaRef])

  // Fire the next onNav in an in-flight flick, scheduling the following one on a
  // widening interval so the run visibly decelerates before it settles.
  const stepFlick = useCallback((): void => {
    const f = flickRef.current
    if (!f || !nav) return
    navDirRef.current = f.dir
    nav.onNav(f.dir)
    f.remaining -= 1
    if (f.remaining > 0) {
      const progress = 1 - f.remaining / f.total
      const delay = 80 + progress * 170
      flickTimerRef.current = window.setTimeout(stepFlick, delay)
    } else {
      flickRef.current = null
    }
  }, [nav])

  const doNav = useCallback(
    (dir: -1 | 1, count: number): void => {
      const mainEl = mediaRef.current
      if (!mainEl || !nav || navAnimatingRef.current) return
      navAnimatingRef.current = true
      const w = window.innerWidth
      gsap.to(mainEl, {
        x: -dir * w * 1.05,
        scale: 0.8,
        opacity: 0.15,
        rotate: dir * 6,
        duration: 0.22,
        ease: 'power2.in',
        onComplete: (): void => {
          flickRef.current = { dir, remaining: count, total: count }
          stepFlick()
        },
      })
    },
    [mediaRef, nav, stepFlick],
  )

  const { bind } = useLightboxSwipe({
    contentScrollable,
    onDrag: (axis, dx, dy): void => {
      if (navAnimatingRef.current) return
      const stage = stageRef.current
      const mainEl = mediaRef.current
      if (axis === 'horizontal' && mainEl) {
        gsap.set(mainEl, { x: dx, rotate: dx / 42, scale: 1 - Math.min(Math.abs(dx) / 2400, 0.1) })
      } else if (axis === 'vertical' && stage && !sheetOpenRef.current) {
        const shift = dy > 0 ? dy : dy * 0.3
        gsap.set(stage, { y: shift, scale: dy > 0 ? Math.max(0.9, 1 - dy / 1600) : 1 })
      }
    },
    onIntent: (intent, info): void => {
      if (intent === 'close') {
        if (sheetOpenRef.current) {
          setSheetOpen(false)
          springBack()
          return
        }
        // Close morph reads .main's live rect, so leaving the drag transform in
        // place lets the card keep shrinking from where the finger left it.
        onClose()
      } else if (intent === 'next' || intent === 'prev') {
        const dir = intent === 'next' ? 1 : -1
        const count = Math.max(1, Math.min(FLICK_MAX_CARDS, 1 + Math.floor(info.speed / FLICK_CARD_DIVISOR)))
        doNav(dir, count)
      } else if (intent === 'sheet') {
        setSheetOpen(true)
        springBack()
      } else {
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
      <div ref={mediaRef} className={styles.main} onClick={(e): void => e.stopPropagation()}>
        {main}
      </div>
      <LightboxInfoSheet open={sheetOpen} onToggle={(): void => setSheetOpen((v) => !v)}>
        {sheet}
      </LightboxInfoSheet>
    </div>
  )
}
