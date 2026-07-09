'use client'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { gsap } from 'gsap'
import { useLightboxSwipe } from './use-lightbox-swipe'
import type { LightboxItem } from '@/lib/share/lightbox-item'
import type { LightboxNav } from './lightbox-nav-types'
import styles from './MobileLightbox.module.css'

type MobileLightboxProps = {
  readonly view: LightboxItem
  /** Morph target: the big-center wrapper the desktop attaches to `.media`.
   *  On mobile the same ref lands on `.main`, so the open/close morph in
   *  Lightbox.tsx grows the card into it. */
  readonly mediaRef: RefObject<HTMLDivElement | null>
  /** The big-center primary content (image / video / tweet body / large text). */
  readonly main: ReactNode
  /** Secondary info (title / description / source) — shown on the caption
   *  screen, sitting directly on the frosted backdrop like the desktop panel. */
  readonly caption: ReactNode
  readonly nav: LightboxNav | null
  readonly onClose: () => void
}

// A hard flick advances more cards, decelerating — like the board's inertial
// scroll. speed is px/ms; every ~0.9 px/ms of release velocity buys one extra
// card, capped so a violent flick can't spin forever.
const FLICK_CARD_DIVISOR = 0.9
const FLICK_MAX_CARDS = 6
const FLICK_FAILSAFE_MS = 1800
// Card ⇄ caption is a vertical two-screen pager: swipe up scrolls the card off
// the top and brings the caption into the SAME centered spot the card occupied
// (no shrink-to-corner). Transition timing:
const CAPTION_SLIDE_DUR = 0.5

/** Immersive, full-screen mobile lightbox (session 180). Tap opens the card big
 *  in the center; left/right swipes slide to the prev/next card (a hard flick
 *  coasts through several, decelerating); swipe UP rides to the caption screen
 *  (card shrinks to the top, caption slides up on the frosted board); swipe DOWN
 *  returns to the card, or — from the card screen — closes. */
export function MobileLightbox({
  view,
  mediaRef,
  main,
  caption,
  nav,
  onClose,
}: MobileLightboxProps): ReactNode {
  const stageRef = useRef<HTMLDivElement>(null)
  const captionRef = useRef<HTMLDivElement>(null)
  const captionInnerRef = useRef<HTMLDivElement>(null)
  const [captionOpen, setCaptionOpen] = useState(false)
  const captionOpenRef = useRef(false)
  captionOpenRef.current = captionOpen
  const navRef = useRef(nav)
  navRef.current = nav
  const navDirRef = useRef<-1 | 0 | 1>(0)
  const navAnimatingRef = useRef(false)
  const flickRef = useRef<{ dir: -1 | 1; remaining: number; total: number } | null>(null)
  const flickTimerRef = useRef<number | null>(null)
  const failsafeRef = useRef<number | null>(null)
  const [navSeq, setNavSeq] = useState(0)

  const clearTimers = useCallback((): void => {
    if (flickTimerRef.current !== null) window.clearTimeout(flickTimerRef.current)
    if (failsafeRef.current !== null) window.clearTimeout(failsafeRef.current)
    flickTimerRef.current = null
    failsafeRef.current = null
  }, [])

  useEffect(() => (): void => clearTimers(), [clearTimers])

  const endNav = useCallback((): void => {
    navAnimatingRef.current = false
    flickRef.current = null
    clearTimers()
    const mainEl = mediaRef.current
    if (mainEl) gsap.set(mainEl, { clearProps: 'transform,opacity' })
  }, [clearTimers, mediaRef])

  // Caption starts one screen below (gsap-managed in px so units never clash
  // with a CSS transform — the previous CSS translateY(100%) vs gsap yPercent
  // mismatch left the caption stuck off-screen = "swipe up shows nothing").
  useLayoutEffect(() => {
    const cap = captionRef.current
    if (cap) gsap.set(cap, { y: window.innerHeight })
  }, [])

  // Card ⇄ caption vertical pager: swipe up scrolls the card off the top and the
  // caption up into the card's centered spot (no shrink). Not the open/close
  // morph — that's Lightbox's.
  const setCaption = useCallback(
    (open: boolean): void => {
      setCaptionOpen(open)
      const mainEl = mediaRef.current
      const capEl = captionRef.current
      const h = window.innerHeight
      if (mainEl) {
        gsap.to(mainEl, {
          y: open ? -h : 0,
          duration: CAPTION_SLIDE_DUR,
          ease: 'power3.inOut',
          onComplete: open
            ? undefined
            : (): void => {
                gsap.set(mainEl, { clearProps: 'transform' })
              },
        })
      }
      if (capEl) gsap.to(capEl, { y: open ? 0 : h, duration: CAPTION_SLIDE_DUR, ease: 'power3.inOut' })
    },
    [mediaRef],
  )

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
        onComplete: last ? endNav : undefined,
      },
    )
  }, [navSeq, view.url, mediaRef, endNav])

  const springBack = useCallback((): void => {
    const mainEl = mediaRef.current
    const stage = stageRef.current
    if (mainEl && !captionOpenRef.current) gsap.to(mainEl, { x: 0, rotate: 0, scale: 1, duration: 0.42, ease: 'elastic.out(1, 0.6)' })
    if (stage) gsap.to(stage, { y: 0, scale: 1, duration: 0.42, ease: 'elastic.out(1, 0.6)' })
  }, [mediaRef])

  const stepFlick = useCallback((): void => {
    const f = flickRef.current
    const liveNav = navRef.current
    if (!f || !liveNav) {
      endNav()
      return
    }
    navDirRef.current = f.dir
    liveNav.onNav(f.dir)
    setNavSeq((n) => n + 1)
    f.remaining -= 1
    if (f.remaining > 0) {
      const progress = 1 - f.remaining / f.total
      flickTimerRef.current = window.setTimeout(stepFlick, 90 + progress * 170)
    } else {
      flickRef.current = null
    }
  }, [endNav])

  const doNav = useCallback(
    (dir: -1 | 1, count: number): void => {
      const mainEl = mediaRef.current
      if (!mainEl || !navRef.current || navAnimatingRef.current) return
      navAnimatingRef.current = true
      failsafeRef.current = window.setTimeout(endNav, FLICK_FAILSAFE_MS)
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
    [mediaRef, stepFlick, endNav],
  )

  const { bind } = useLightboxSwipe({
    // On the caption screen, a vertical drag first scrolls the caption; only at
    // its top does a down-swipe return to the card.
    contentScrollable: (): { top: boolean; bottom: boolean } => {
      const cap = captionInnerRef.current
      if (!captionOpenRef.current || !cap) return { top: true, bottom: true }
      return {
        top: cap.scrollTop <= 0,
        bottom: cap.scrollTop + cap.clientHeight >= cap.scrollHeight - 1,
      }
    },
    onDrag: (axis, dx, dy): void => {
      if (navAnimatingRef.current || captionOpenRef.current) return
      const stage = stageRef.current
      const mainEl = mediaRef.current
      if (axis === 'horizontal' && mainEl) {
        gsap.set(mainEl, { x: dx, rotate: dx / 42, scale: 1 - Math.min(Math.abs(dx) / 2400, 0.1) })
      } else if (axis === 'vertical' && stage && dy > 0) {
        gsap.set(stage, { y: dy, scale: Math.max(0.9, 1 - dy / 1600) })
      }
    },
    onIntent: (intent, info): void => {
      if (intent === 'sheet') {
        // swipe up → caption screen (only from the card screen)
        if (!captionOpenRef.current) setCaption(true)
      } else if (intent === 'close') {
        // swipe down → back to the card screen, or close if already there
        if (captionOpenRef.current) {
          setCaption(false)
          return
        }
        onClose()
      } else if ((intent === 'next' || intent === 'prev') && !captionOpenRef.current) {
        const dir = intent === 'next' ? 1 : -1
        const count = Math.max(1, Math.min(FLICK_MAX_CARDS, 1 + Math.floor(info.speed / FLICK_CARD_DIVISOR)))
        doNav(dir, count)
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
        if (e.target !== stageRef.current) return
        if (captionOpenRef.current) setCaption(false)
        else onClose()
      }}
      {...bind}
    >
      <div ref={mediaRef} className={styles.main} onClick={(e): void => e.stopPropagation()}>
        {main}
      </div>
      <div
        ref={captionRef}
        className={styles.caption}
        data-testid="lightbox-caption"
        data-open={captionOpen ? 'true' : 'false'}
        onClick={(e): void => e.stopPropagation()}
      >
        <div ref={captionInnerRef} className={styles.captionInner}>
          {caption}
        </div>
      </div>
    </div>
  )
}
