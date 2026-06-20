// components/onboarding/OnboardingTagTyper.tsx
'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { gsap } from 'gsap'
import styles from './OnboardingTagTyper.module.css'

type Props = {
  /** The tag text to type out, character by character (e.g. "sample"). */
  readonly text: string
  /** Fired the instant the finished chip pops in — the controller applies the
   *  REAL tag here so the genuine green pill lands on the genuine card while the
   *  demo chip is shown. */
  readonly onApply: () => void
  /** Fired after the demo menu has held + faded — the controller reveals the
   *  "tagged" confirmation + NEXT. Decoupled from the channel so NEXT appears
   *  even if the real tag-add signal is delayed. */
  readonly onFinished: () => void
}

// Per-character cadence tuned to the rest of the onboarding motion (badge pop
// back.out(1.7), chips stagger). ~55ms/char with a small humanizing jitter so
// it doesn't read as a robotic ticker.
const CHAR_MS = 55
const JITTER_MS = 15
const START_DELAY_MS = 220
const COMMIT_PAUSE_MS = 240

/**
 * A faithful re-enactment of the board's real tag menu (TagAddPopover) typing a
 * tag in by hand. Styled to match the real popover (rgba(20,20,20,.95) glass,
 * blur(12px), monospace chips, green focus border) so the first-timer learns the
 * actual gesture, not a generic mock. Non-interactive (it's a guided demo); the
 * controller blocks board input underneath while it plays.
 */
export function OnboardingTagTyper({ text, onApply, onFinished }: Props): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null)
  const chipRef = useRef<HTMLSpanElement>(null)
  const [typed, setTyped] = useState(0)
  const [committed, setCommitted] = useState(false)
  // Keep the latest callbacks without re-running the one-shot effect.
  const onApplyRef = useRef(onApply)
  const onFinishedRef = useRef(onFinished)
  onApplyRef.current = onApply
  onFinishedRef.current = onFinished

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timers: ReturnType<typeof setTimeout>[] = []
    let tl: gsap.core.Timeline | null = null

    if (reduce) {
      // No typing animation — show the end state and hand off immediately.
      setTyped(text.length)
      setCommitted(true)
      onApplyRef.current()
      const t = setTimeout(() => onFinishedRef.current(), 400)
      timers.push(t)
      return () => timers.forEach(clearTimeout)
    }

    let i = 0
    const typeNext = (): void => {
      i += 1
      setTyped(i)
      if (i < text.length) {
        const jitter = (Math.random() * 2 - 1) * JITTER_MS
        timers.push(setTimeout(typeNext, CHAR_MS + jitter))
        return
      }
      // Last char typed → brief pause → commit the chip.
      timers.push(
        setTimeout(() => {
          setCommitted(true)
          onApplyRef.current() // the real tag lands as the demo chip appears
          requestAnimationFrame(() => {
            tl = gsap.timeline()
            if (chipRef.current) {
              tl.from(chipRef.current, {
                scale: 0.7, opacity: 0, duration: 0.35, ease: 'back.out(1.7)',
              })
            }
            tl.to({}, { duration: 0.9 }) // hold so the chip + the real pill both register
            if (rootRef.current) {
              tl.to(rootRef.current, { opacity: 0, y: -4, duration: 0.3, ease: 'power2.in' })
            }
            tl.add(() => onFinishedRef.current())
          })
        }, COMMIT_PAUSE_MS),
      )
    }
    timers.push(setTimeout(typeNext, START_DELAY_MS))

    return () => {
      timers.forEach(clearTimeout)
      if (tl) tl.kill()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const shown = text.slice(0, typed)
  const stillTyping = typed < text.length

  return (
    <div ref={rootRef} className={styles.menu} data-testid="onboarding-tag-typer" aria-hidden="true">
      <div className={styles.header}>+ TAG</div>
      <div className={styles.chipRow}>
        {committed && <span ref={chipRef} className={styles.chip}>✓ {text}</span>}
      </div>
      <div className={styles.input}>
        {committed ? (
          <span className={styles.placeholder}>new tag…</span>
        ) : (
          <>
            <span className={styles.typed}>{shown}</span>
            <span className={styles.caret} data-typing={stillTyping ? 'true' : undefined} />
          </>
        )}
      </div>
    </div>
  )
}
