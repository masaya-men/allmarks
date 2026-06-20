// components/onboarding/OnboardingTagDemo.tsx
'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { gsap } from 'gsap'
import styles from './OnboardingTagDemo.module.css'

type Props = {
  /** The tag text to type out, character by character (e.g. "sample"). */
  readonly text: string
  /** Per-character cadence in ms (deliberately slow for the tutorial). */
  readonly charMs: number
  /** Fired when the finished chip commits — the controller applies the REAL tag
   *  here so the genuine green pill lands on the genuine card. */
  readonly onApply: () => void
  /** Fired after the menu has held — the controller darkens the scene and reveals
   *  the closing message + NEXT. */
  readonly onFinished: () => void
}

/**
 * A guided, on-rails re-enactment of tagging a card: it first highlights the
 * "+ TAG" button (green glow + scale), a demo cursor glides over and presses it
 * (button reacts), the real tag menu opens, the input lights up, and the tag is
 * typed in slowly so the gesture is unmistakable. Mirrors the board's real
 * TagAddPopover look (rgba(20,20,20,.95) glass, monospace, green chips). Pure
 * GSAP, non-interactive (the controller blocks the board underneath).
 */
export function OnboardingTagDemo({ text, charMs, onApply, onFinished }: Props): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null)
  const [typed, setTyped] = useState(0)
  const [committed, setCommitted] = useState(false)
  const onApplyRef = useRef(onApply)
  const onFinishedRef = useRef(onFinished)
  onApplyRef.current = onApply
  onFinishedRef.current = onFinished

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const q = (sel: string): Element | null => root.querySelector(sel)
    const tagBtn = q('[data-anim="tagbtn"]')
    const menu = q('[data-anim="menu"]')
    const input = q('[data-anim="input"]')
    const chip = q('[data-anim="chip"]')
    const cursor = q('[data-anim="cursor"]')
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduce) {
      gsap.set(menu, { opacity: 1, scale: 1, y: 0 })
      gsap.set(tagBtn, { opacity: 0 })
      gsap.set(chip, { opacity: 1, scale: 1 })
      gsap.set(cursor, { opacity: 0 })
      setTyped(text.length)
      setCommitted(true)
      onApplyRef.current()
      const t = setTimeout(() => onFinishedRef.current(), 500)
      return () => clearTimeout(t)
    }

    const counter = { v: 0 }
    gsap.set(menu, { opacity: 0, scale: 0.96, y: -6 })
    gsap.set(chip, { opacity: 0, scale: 0.7 })
    gsap.set(tagBtn, { opacity: 1, scale: 1, backgroundColor: 'rgba(40,241,0,0.16)', color: '#28f100' })
    gsap.set(cursor, { left: 150, top: 116, opacity: 0, scale: 1 })

    const tl = gsap.timeline()
    tl
      // 1) draw the eye to "+ TAG"
      .to(cursor, { opacity: 1, duration: 0.3, ease: 'power2.out' })
      .to(tagBtn, { boxShadow: '0 0 0 6px rgba(40,241,0,0.22)', scale: 1.12, duration: 0.5, yoyo: true, repeat: 1, ease: 'sine.inOut' }, '<')
      // 2) cursor glides over and presses (the button reacts so the click reads)
      .to(cursor, { left: 30, top: 14, duration: 0.85, ease: 'power2.inOut' })
      .to(cursor, { scale: 0.76, duration: 0.13, yoyo: true, repeat: 1, ease: 'power1.inOut' })
      .to(tagBtn, { scale: 0.88, duration: 0.13, yoyo: true, repeat: 1 }, '<')
      .to(tagBtn, { backgroundColor: 'rgba(40,241,0,0.95)', color: '#0a0a0a', duration: 0.13, yoyo: true, repeat: 1 }, '<')
      // 3) the menu opens; cursor drops to the input, which lights up
      .to(tagBtn, { opacity: 0, duration: 0.2 })
      .to(menu, { opacity: 1, scale: 1, y: 0, duration: 0.38, ease: 'back.out(1.4)' }, '-=0.08')
      .to(cursor, { left: 46, top: 80, duration: 0.45, ease: 'power2.inOut' }, '<')
      .to(input, { boxShadow: '0 0 0 3px rgba(40,241,0,0.28)', duration: 0.4, yoyo: true, repeat: 1, ease: 'sine.inOut' }, '<')
      // 4) type the tag in slowly
      .to(counter, {
        v: text.length,
        duration: (text.length * charMs) / 1000,
        ease: 'none',
        onUpdate: () => setTyped(Math.min(text.length, Math.floor(counter.v))),
      }, '+=0.15')
      .add(() => setTyped(text.length))
      // 5) commit the chip + apply the REAL tag to the REAL card
      .to({}, { duration: 0.22 })
      .add(() => { setCommitted(true); onApplyRef.current() })
      .to(chip, { opacity: 1, scale: 1, duration: 0.38, ease: 'back.out(1.7)' })
      // 6) hold so the chip + the real pill both register, then hand off
      .to({}, { duration: 0.9 })
      .add(() => onFinishedRef.current())

    return () => { tl.kill() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const shown = text.slice(0, typed)
  const stillTyping = typed < text.length

  return (
    <div ref={rootRef} className={styles.wrap} data-testid="onboarding-tag-demo" aria-hidden="true">
      <button type="button" tabIndex={-1} data-anim="tagbtn" className={styles.tagBtn}>+ TAG</button>
      <div data-anim="menu" className={styles.menu}>
        <div className={styles.header}>+ TAG</div>
        <div className={styles.chipRow}>
          <span data-anim="chip" className={styles.chip}>✓ {text}</span>
        </div>
        <div data-anim="input" className={styles.input}>
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
      <span data-anim="cursor" className={styles.cursor} />
    </div>
  )
}
