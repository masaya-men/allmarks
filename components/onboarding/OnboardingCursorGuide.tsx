// components/onboarding/OnboardingCursorGuide.tsx
'use client'

import { useEffect, useRef, type ReactElement } from 'react'
import { gsap } from 'gsap'
import styles from './OnboardingCursorGuide.module.css'

type Props = {
  /** CSS selector of the real element to guide the eye to (the MOTION /
   *  SETTINGS / MANAGE button). The cursor glides in and presses it on a loop. */
  readonly targetSelector: string
}

/**
 * A non-interactive green demo cursor that glides to a real interactive target
 * and presses it on a loop — the shared "press here" eye-guidance for the
 * spotlight scenes (MOTION / SETTINGS / MANAGE), matching the SHARE scene's
 * cursor. The spotlight already rings + pulses the target; this adds the cursor
 * motion so the user always sees WHERE to click. pointer-events:none, so the
 * real button underneath stays clickable through the spotlight hole.
 */
export function OnboardingCursorGuide({ targetSelector }: Props): ReactElement {
  const cursorRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const cursor = cursorRef.current
    if (!cursor || typeof window === 'undefined') return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const rectOf = (): DOMRect | null =>
      document.querySelector<HTMLElement>(targetSelector)?.getBoundingClientRect() ?? null

    if (reduce) { gsap.set(cursor, { opacity: 0 }); return }

    let tl: gsap.core.Timeline | null = null
    // Wait a beat so the spotlight has measured the target and the header has
    // settled, then read the live rect (functional values re-read every loop, so
    // the cursor still lands true if the layout shifts).
    const cx = (): number => { const r = rectOf(); return r ? r.left + r.width / 2 : 0 }
    const cy = (): number => { const r = rectOf(); return r ? r.top + r.height / 2 : 0 }
    const startTimer = window.setTimeout(() => {
      if (!rectOf()) return
      gsap.set(cursor, { left: cx() - 52, top: cy() + 40, opacity: 0, scale: 1 })
      tl = gsap.timeline({ repeat: -1, repeatDelay: 1.2 })
      tl.to(cursor, { opacity: 1, duration: 0.3, ease: 'power2.out' })
        .to(cursor, { left: cx, top: cy, duration: 0.85, ease: 'power2.inOut' }, '+=0.15')
        .to(cursor, { scale: 0.76, duration: 0.12, yoyo: true, repeat: 1, ease: 'power1.inOut' })
        .to(cursor, { opacity: 0, duration: 0.3 }, '+=0.55')
        .set(cursor, { left: () => cx() - 52, top: () => cy() + 40 })
    }, 280)

    return () => { window.clearTimeout(startTimer); if (tl) tl.kill() }
  }, [targetSelector])

  return <span ref={cursorRef} className={styles.cursor} aria-hidden="true" />
}
