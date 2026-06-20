// components/onboarding/ExtensionSaveReenactment.tsx
'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { gsap } from 'gsap'
import styles from './ExtensionSaveReenactment.module.css'

type Props = {
  readonly caption: string
  readonly buttonLabel: string
  readonly onAdvance: () => void
}

const DEMO_TAGS = ['design', 'video', 'inspo'] as const

/**
 * A promo-quality re-enactment of the AllMarks browser extension saving the open
 * page in one click and tagging it. Built entirely with GSAP so it's crisp at any
 * DPR and on-theme. The beats read like a product PV: (1) the cursor clicks the
 * AllMarks button → (2) a green save-flash sweeps the page → (3) a "Saved" pill
 * pops → (4) the real tag menu slides up and the cursor SELECTS tags one by one,
 * each lighting up green. Loops; after the first pass it pulses NEXT so the user
 * knows they can move on (the loop is a showcase, not a wait).
 */
export function ExtensionSaveReenactment({ caption, buttonLabel, onAdvance }: Props): ReactElement {
  const ref = useRef<HTMLDivElement>(null)
  const ctaRef = useRef<HTMLButtonElement>(null)
  const [cuePulse, setCuePulse] = useState(false)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const q = (sel: string): Element | null => root.querySelector(sel)
    const qa = (sel: string): Element[] => Array.from(root.querySelectorAll(sel))

    const cursor = q('[data-anim="cursor"]')
    const btn = q('[data-anim="btn"]')
    const flash = q('[data-anim="flash"]')
    const pill = q('[data-anim="pill"]')
    const menu = q('[data-anim="menu"]')
    const chips = qa('[data-anim="chip"]')
    const checks = chips.map((c) => c.querySelector('[data-anim="check"]'))

    const showEnd = (): void => {
      gsap.set(flash, { opacity: 0 })
      gsap.set(pill, { opacity: 1, scale: 1, y: 0 })
      gsap.set(menu, { opacity: 1, y: 0 })
      gsap.set(chips, { color: '#28f100' })
      gsap.set(checks, { opacity: 1, width: 'auto' })
    }

    if (reduce) {
      showEnd()
      setCuePulse(true)
      return
    }

    const hideAll = (): void => {
      gsap.set(flash, { opacity: 0 })
      gsap.set(pill, { opacity: 0, scale: 0.7, y: 6 })
      gsap.set(menu, { opacity: 0, y: 14 })
      gsap.set(chips, { color: 'rgba(255,255,255,0.82)' })
      gsap.set(checks, { opacity: 0, width: 0 })
      gsap.set(cursor, { left: '12%', top: '86%', scale: 1 })
      gsap.set(btn, { boxShadow: '0 0 0 0 rgba(40,241,0,0)' })
    }
    hideAll()

    const tl = gsap.timeline({
      repeat: -1,
      repeatDelay: 0.9,
      onRepeat: () => setCuePulse(true), // first loop done → tell the user NEXT is live
    })
    tl
      .add(hideAll)
      // 1) the extension button draws the eye
      .to(btn, { boxShadow: '0 0 0 7px rgba(40,241,0,0.22)', duration: 0.5, yoyo: true, repeat: 1, ease: 'sine.inOut' })
      // 2) cursor glides up to the button and presses it
      .to(cursor, { left: '90%', top: '11%', duration: 1.0, ease: 'power2.inOut' }, '-=0.45')
      .to(cursor, { scale: 0.78, duration: 0.13, yoyo: true, repeat: 1, ease: 'power1.inOut' })
      .to(btn, { backgroundColor: 'rgba(40,241,0,0.95)', color: '#0a0a0a', duration: 0.14, yoyo: true, repeat: 1 }, '<')
      // 3) a green save-flash sweeps the page
      .fromTo(flash, { opacity: 0, x: '-30%' }, { opacity: 0.55, x: '0%', duration: 0.22, ease: 'power2.out' }, '<')
      .to(flash, { opacity: 0, x: '30%', duration: 0.45, ease: 'power2.in' })
      // 4) the "Saved" pill pops
      .to(pill, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(1.8)' }, '-=0.2')
      // 5) the real tag menu slides up
      .to(menu, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }, '+=0.15')
      // 6) cursor moves to each chip and selects it (chip lights up green + ✓)
      .to(cursor, { left: '34%', top: '74%', duration: 0.6, ease: 'power2.inOut' }, '+=0.1')
      .to(cursor, { scale: 0.8, duration: 0.11, yoyo: true, repeat: 1 })
      .to(chips[0] ?? {}, { color: '#28f100', duration: 0.2 }, '<')
      .to(checks[0] ?? {}, { opacity: 1, width: 'auto', duration: 0.22, ease: 'back.out(2)' }, '<')
      .to(cursor, { left: '56%', top: '74%', duration: 0.5, ease: 'power2.inOut' }, '+=0.15')
      .to(cursor, { scale: 0.8, duration: 0.11, yoyo: true, repeat: 1 })
      .to(chips[1] ?? {}, { color: '#28f100', duration: 0.2 }, '<')
      .to(checks[1] ?? {}, { opacity: 1, width: 'auto', duration: 0.22, ease: 'back.out(2)' }, '<')
      // 7) hold so the viewer reads the finished, tagged state
      .to({}, { duration: 1.5 })

    return () => { tl.kill() }
  }, [])

  return (
    <div className={styles.stage} data-testid="stage-extDemo">
      <div ref={ref} className={styles.browser}>
        <div className={styles.chrome}>
          <span className={styles.close} aria-hidden="true" />
          <span className={styles.urlbar}>cool-article.example</span>
          <span data-anim="btn" className={styles.extBtn} aria-hidden="true">
            <span className={styles.extA}>A</span>
          </span>
        </div>
        <div className={styles.viewport}>
          <div className={styles.hero}>
            <div className={styles.heroWave} aria-hidden="true">
              {Array.from({ length: 9 }).map((_, i) => (
                <span key={i} className={styles.heroBar} style={{ ['--i' as string]: i }} />
              ))}
            </div>
          </div>
          <div className={styles.lines}>
            <span className={styles.title} />
            <span className={styles.line} style={{ width: '90%' }} />
            <span className={styles.line} style={{ width: '64%' }} />
          </div>
          <div data-anim="flash" className={styles.flash} aria-hidden="true" />
          <div data-anim="pill" className={styles.savePill}>
            <span className={styles.savedCheck} aria-hidden="true">✓</span>
            <span>Saved to AllMarks</span>
          </div>
          <div data-anim="menu" className={styles.tagMenu}>
            <div className={styles.tagHeader}>+ TAG</div>
            <div className={styles.tagChips}>
              {DEMO_TAGS.map((name) => (
                <span key={name} data-anim="chip" className={styles.tagChip}>
                  <span data-anim="check" className={styles.chipCheck} aria-hidden="true">✓</span>
                  <span className={styles.chipName}>{name}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
        <span data-anim="cursor" className={styles.cursor} aria-hidden="true" />
      </div>
      <p className={styles.caption}>{caption}</p>
      <button
        ref={ctaRef}
        type="button"
        className={styles.cta}
        data-cue={cuePulse ? 'true' : undefined}
        onClick={onAdvance}
      >
        {buttonLabel}
      </button>
    </div>
  )
}
