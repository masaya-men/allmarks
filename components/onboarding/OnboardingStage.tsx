// components/onboarding/OnboardingStage.tsx
'use client'

import { useEffect, useRef, type ReactElement } from 'react'
import { gsap } from 'gsap'
import { OnboardingLanguagePicker } from './OnboardingLanguagePicker'
import styles from './OnboardingStage.module.css'

type Props = {
  readonly variant: 'enter' | 'finale'
  readonly caption: string
  readonly buttonLabel: string
  readonly onAdvance: () => void
}

export function OnboardingStage({ variant, caption, buttonLabel, onAdvance }: Props): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const wave = root.querySelectorAll('[data-anim="wave"]')
    const logo = root.querySelector('[data-anim="logo"]')
    const check = root.querySelector('[data-anim="check"]')
    const copy = root.querySelectorAll('[data-anim="copy"]')
    if (reduce) {
      // finale has no logo/check nodes — filter nulls so gsap doesn't warn.
      gsap.set([logo, check, ...copy].filter(Boolean), { opacity: 1, scale: 1, y: 0 })
      return
    }
    const tl = gsap.timeline()
    tl.from(wave, { scaleX: 0, opacity: 0, duration: 0.6, stagger: 0.06, ease: 'power2.out' })
    // logo/check only exist on the enter variant; skip cleanly for finale.
    if (logo) tl.from(logo, { opacity: 0, scale: 0.8, duration: 0.5, ease: 'back.out(1.6)' }, '-=0.2')
    if (check) tl.from(check, { opacity: 0, scale: 0.4, duration: 0.35, ease: 'back.out(2)' }, '-=0.1')
    tl.from(copy, { opacity: 0, y: 12, duration: 0.4, stagger: 0.08 }, '-=0.1')
    // Keep the sound-wave motif alive after the intro settles — a gentle infinite
    // oscillation so the brand's signature waveform isn't frozen at the two
    // highest-stakes moments (first impression + finale).
    tl.to(wave, {
      scaleY: 1.5,
      duration: 1.1,
      ease: 'sine.inOut',
      stagger: { each: 0.09, from: 'center' },
      repeat: -1,
      yoyo: true,
    }, '+=0.05')
    return () => { tl.kill() }
  }, [variant])

  return (
    <div ref={rootRef} className={styles.stage} data-testid={`stage-${variant}`}>
      {/* Let first-timers set the tutorial's language before they begin. */}
      {variant === 'enter' && (
        <div className={styles.langPicker}>
          <OnboardingLanguagePicker />
        </div>
      )}
      <div className={styles.waves}>
        {Array.from({ length: 7 }).map((_, i) => (
          <span key={i} data-anim="wave" className={styles.wave} />
        ))}
      </div>
      {variant === 'enter' && (
        <div className={styles.mark}>
          <svg data-anim="logo" className={styles.logo} viewBox="0 0 48 48" aria-hidden="true">
            <path d="M24 6 L40 42 L31 42 L24 24 L17 42 L8 42 Z" fill="#0a0a0a" stroke="rgba(255,255,255,0.85)" strokeWidth="1.5" />
          </svg>
          <span data-anim="check" className={styles.check}>✓</span>
        </div>
      )}
      <p data-anim="copy" className={styles.caption}>{caption}</p>
      <button data-anim="copy" type="button" className={styles.cta} onClick={onAdvance}>
        {buttonLabel}
      </button>
    </div>
  )
}
