// components/onboarding/PopOutReenactment.tsx
'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { gsap } from 'gsap'
import styles from './PopOutReenactment.module.css'

type Props = {
  readonly caption: string
  readonly buttonLabel: string
  readonly onAdvance: () => void
}

// Neutral labels — no borrowed brand. Two cards so the meter ticks 01 → 02,
// mirroring the real PiP where each save appends to the RIGHT end of the
// carousel and auto-scrolls the newest to centre.
const DEMO_CARDS = ['clip', 'article'] as const

const pad = (n: number): string => String(n).padStart(2, '0')

/**
 * POP OUT (Document Picture-in-Picture) re-enactment. A faithful mock — the
 * real PiP can't be driven inline (OS window + user gesture), same as the
 * extension/bookmarklet demos. Cards GLIDE IN FROM THE RIGHT and settle at
 * centre (ease-out quart / 0.7s = the real PipStack auto-scroll), and an
 * always-on meter below ticks current/total as the deck grows. Does NOT open
 * real PiP and does NOT import PipStack/PipCompanion (pure visual facsimile).
 */
export function PopOutReenactment({ caption, buttonLabel, onAdvance }: Props): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null)
  const [count, setCount] = useState<number>(0)
  const [cuePulse, setCuePulse] = useState<boolean>(false)

  useEffect((): (() => void) | undefined => {
    const root = rootRef.current
    if (!root) return undefined
    const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-anim^="card"]'))
    if (cards.length < 2) return undefined

    const reduce =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false

    const reset = (): void => {
      gsap.set(cards, { xPercent: 260, opacity: 0 }) // parked off to the right
      setCount(0)
    }

    if (reduce) {
      // Static end state: both cards centred (last one on top), meter full.
      gsap.set(cards[0], { xPercent: -110, opacity: 1 })
      gsap.set(cards[1], { xPercent: 0, opacity: 1 })
      setCount(2)
      setCuePulse(true)
      return undefined
    }

    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.1, onRepeat: () => setCuePulse(true) })
    tl.call(reset)
      .to({}, { duration: 0.35 })
      // card 1 glides in from the right → centre (ease-out quart, 0.7s = real PiP)
      .to(cards[0], { xPercent: 0, opacity: 1, duration: 0.7, ease: 'power4.out' })
      .call(() => setCount(1))
      .to({}, { duration: 0.9 })
      // card 2 arrives; card 1 slides left out of the way (the carousel advances)
      .to(cards[0], { xPercent: -110, duration: 0.7, ease: 'power4.out' }, 'in2')
      .to(cards[1], { xPercent: 0, opacity: 1, duration: 0.7, ease: 'power4.out' }, 'in2')
      .call(() => setCount(2))
      .to({}, { duration: 1.7 })

    return () => { tl.kill() }
  }, [])

  return (
    <div className={styles.stage} data-testid="stage-popout-demo">
      {/* faint suggestion of "other apps" behind the floating companion */}
      <div className={styles.backdrop} aria-hidden="true" />
      <div ref={rootRef} className={styles.window} aria-hidden="true">
        <div className={styles.titlebar}><span className={styles.dot} />POP OUT</div>
        <div className={styles.carousel}>
          {DEMO_CARDS.map((c, i) => (
            <div key={c} data-anim={`card${i}`} className={styles.card}>{c}</div>
          ))}
        </div>
        <div className={styles.meter}>
          <span className={styles.meterText}>{pad(count)} / {pad(count)}</span>
        </div>
      </div>
      <p className={styles.caption}>{caption}</p>
      <button
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
