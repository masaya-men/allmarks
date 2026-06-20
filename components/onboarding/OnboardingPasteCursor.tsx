// components/onboarding/OnboardingPasteCursor.tsx
'use client'

import { useEffect, useRef, type ReactElement } from 'react'
import { gsap } from 'gsap'
import styles from './OnboardingPasteCursor.module.css'

/**
 * A demo cursor for the paste scene's second beat (after the user copies the
 * sample link). It glides to an empty-ish area of the now-bright board and
 * "presses" there with a green ring pulse — a wordless cue for "your pasted card
 * will land around here, paste with Cmd/Ctrl+V". Pure GSAP, reuses the teardrop
 * cursor from the extension re-enactment so the language is consistent. Loops
 * gently; non-interactive (pointer-events: none) so it never blocks the paste.
 */
export function OnboardingPasteCursor(): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const cursor = root.querySelector('[data-anim="cursor"]')
    const ring = root.querySelector('[data-anim="ring"]')
    if (!cursor || !ring) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Enter from the upper-left, settle on a lower-center "drop" spot.
    const startX = '36%'
    const startY = '38%'
    const dropX = '50%'
    const dropY = '60%'

    gsap.set(ring, { left: dropX, top: dropY, xPercent: -50, yPercent: -50, opacity: 0, scale: 0.4 })

    if (reduce) {
      gsap.set(cursor, { left: dropX, top: dropY, scale: 1, opacity: 1 })
      gsap.set(ring, { opacity: 0.45, scale: 1 })
      return
    }

    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.9 })
    tl
      .set(cursor, { left: startX, top: startY, scale: 1, opacity: 0 })
      .to(cursor, { opacity: 1, duration: 0.3, ease: 'power2.out' })
      .to(cursor, { left: dropX, top: dropY, duration: 1.0, ease: 'power2.inOut' })
      // press
      .to(cursor, { scale: 0.74, duration: 0.13, yoyo: true, repeat: 1, ease: 'power1.inOut' })
      // ring pulse synced to the press
      .fromTo(
        ring,
        { opacity: 0.6, scale: 0.4 },
        { opacity: 0, scale: 1.6, duration: 0.7, ease: 'power2.out' },
        '<',
      )
      // hold so the cue reads, then fade out before the loop restarts
      .to({}, { duration: 1.1 })
      .to(cursor, { opacity: 0, duration: 0.4, ease: 'power2.in' })

    return () => { tl.kill() }
  }, [])

  return (
    <div ref={rootRef} className={styles.layer} aria-hidden="true">
      <span data-anim="ring" className={styles.ring} />
      <span data-anim="cursor" className={styles.cursor} />
    </div>
  )
}
