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

export function ExtensionSaveReenactment({ caption, buttonLabel, onAdvance }: Props): ReactElement {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const cursor = root.querySelector('[data-anim="cursor"]')
    const flash = root.querySelector('[data-anim="flash"]')
    const strip = root.querySelector('[data-anim="strip"]')
    const chips = root.querySelectorAll('[data-anim="chip"]')
    if (reduce) {
      gsap.set(strip, { y: 0, opacity: 1 }); gsap.set(chips, { opacity: 1 })
      return
    }
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.1 })
    tl.set(strip, { y: -12, opacity: 0 })
      .set(chips, { opacity: 0 })
      .set(flash, { opacity: 0 })
      .to(cursor, { left: '78%', top: '20%', duration: 0.8, ease: 'power2.inOut' })
      .to(cursor, { scale: 0.85, duration: 0.12, yoyo: true, repeat: 1 }) // click
      .to(flash, { opacity: 0.7, duration: 0.12, yoyo: true, repeat: 1 }, '<')
      .to(strip, { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' }, '+=0.1')
      .to(chips, { opacity: 1, duration: 0.25, stagger: 0.1 }, '-=0.1')
      .to({}, { duration: 1.0 }) // hold
    return () => { tl.kill() }
  }, [])

  return (
    <div className={styles.stage} data-testid="stage-extDemo">
      <div ref={ref} className={styles.browser}>
        <div className={styles.toolbar}>
          <span className={styles.dot} /><span className={styles.dot} /><span className={styles.dot} />
          <span className={styles.url}>example.com</span>
          <span className={styles.extIcon}>A</span>
          <span data-anim="flash" className={styles.flash} />
        </div>
        <div className={styles.page} />
        <div data-anim="strip" className={styles.strip}>
          <span data-anim="chip" className={styles.chip}>design ✓</span>
          <span data-anim="chip" className={styles.chip}>ref ✓</span>
        </div>
        <span data-anim="cursor" className={styles.cursor} />
      </div>
      <p className={styles.caption}>{caption}</p>
      <button type="button" className={styles.cta} onClick={onAdvance}>{buttonLabel}</button>
    </div>
  )
}
