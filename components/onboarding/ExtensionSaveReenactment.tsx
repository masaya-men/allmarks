// components/onboarding/ExtensionSaveReenactment.tsx
'use client'

import { useEffect, useRef, type ReactElement } from 'react'
import { gsap } from 'gsap'
import styles from './ExtensionSaveReenactment.module.css'

type Props = {
  readonly caption: string
  readonly buttonLabel: string
  readonly onAdvance: () => void
}

/**
 * A "video-style" re-enactment of the browser extension saving the open page in
 * one click and auto-tagging it. Built entirely with GSAP so it's crisp at any
 * DPR and follows the theme. Deliberately large, slow and high-contrast so the
 * three beats read clearly: (1) cursor clicks the AllMarks button → (2) a big
 * "Saved" badge confirms → (3) tag chips drop in.
 */
export function ExtensionSaveReenactment({ caption, buttonLabel, onAdvance }: Props): ReactElement {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const cursor = root.querySelector('[data-anim="cursor"]')
    const btn = root.querySelector('[data-anim="btn"]')
    const badge = root.querySelector('[data-anim="badge"]')
    const strip = root.querySelector('[data-anim="strip"]')
    const chips = root.querySelectorAll('[data-anim="chip"]')

    if (reduce) {
      // Show the end state: saved + tagged, no motion.
      gsap.set(badge, { opacity: 1, scale: 1 })
      gsap.set(strip, { opacity: 1, y: 0 })
      gsap.set(chips, { opacity: 1 })
      return
    }

    // Pre-hide the animated-in pieces synchronously (no first-frame flash).
    gsap.set([badge], { opacity: 0, scale: 0.7 })
    gsap.set(strip, { opacity: 0, y: -10 })
    gsap.set(chips, { opacity: 0 })
    gsap.set(cursor, { left: '18%', top: '78%' })

    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.4 })
    tl
      // reset each loop
      .set([badge], { opacity: 0, scale: 0.7 })
      .set(strip, { opacity: 0, y: -10 })
      .set(chips, { opacity: 0 })
      .set(cursor, { left: '18%', top: '78%', scale: 1 })
      .set(btn, { boxShadow: '0 0 0 0 rgba(40,241,0,0)' })
      // 1) the extension button pulses to draw the eye
      .to(btn, { boxShadow: '0 0 0 6px rgba(40,241,0,0.25)', duration: 0.5, yoyo: true, repeat: 1, ease: 'sine.inOut' })
      // 2) cursor glides up to the button and presses
      .to(cursor, { left: '90%', top: '13%', duration: 1.0, ease: 'power2.inOut' }, '-=0.4')
      .to(cursor, { scale: 0.8, duration: 0.14, yoyo: true, repeat: 1, ease: 'power1.inOut' })
      .to(btn, { backgroundColor: 'rgba(40,241,0,0.9)', color: '#0a0a0a', duration: 0.15, yoyo: true, repeat: 1 }, '<')
      // 3) the big Saved badge pops in
      .to(badge, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.7)' }, '+=0.1')
      // 4) tag chips drop in one by one
      .to(strip, { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' }, '+=0.15')
      .to(chips, { opacity: 1, duration: 0.25, stagger: 0.14 }, '-=0.1')
      // hold so the viewer can read it
      .to({}, { duration: 1.6 })

    return () => { tl.kill() }
  }, [])

  return (
    <div className={styles.stage} data-testid="stage-extDemo">
      <div ref={ref} className={styles.browser}>
        <div className={styles.chrome}>
          <span className={styles.dot} /><span className={styles.dot} /><span className={styles.dot} />
          <span className={styles.urlbar}>example.com</span>
          <span data-anim="btn" className={styles.extBtn} aria-hidden="true">
            <span className={styles.extA}>A</span>
          </span>
        </div>
        <div className={styles.viewport}>
          <div className={styles.hero} />
          <div className={styles.lines}>
            <span className={styles.line} style={{ width: '72%' }} />
            <span className={styles.line} style={{ width: '90%' }} />
            <span className={styles.line} style={{ width: '60%' }} />
          </div>
          <div data-anim="badge" className={styles.savedBadge}>
            <span className={styles.savedCheck}>✓</span>
            <span>Saved to AllMarks</span>
          </div>
          <div data-anim="strip" className={styles.strip}>
            <span data-anim="chip" className={styles.chip}>design&nbsp;✓</span>
            <span data-anim="chip" className={styles.chip}>video&nbsp;✓</span>
            <span data-anim="chip" className={styles.chip}>ref&nbsp;✓</span>
          </div>
        </div>
        <span data-anim="cursor" className={styles.cursor} aria-hidden="true" />
      </div>
      <p className={styles.caption}>{caption}</p>
      <button type="button" className={styles.cta} onClick={onAdvance}>{buttonLabel}</button>
    </div>
  )
}
