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

type Box = { left: number; top: number; width: number; height: number; bottom: number }

const MENU_W = 240

/**
 * A guided, on-rails re-enactment of tagging a card, anchored to the REAL card.
 * It measures the card's real "+ TAG" button, highlights THAT button (green
 * glow), glides a demo cursor over and presses it, then opens the tag menu right
 * where the real popover would, lights the input and types the tag in slowly so
 * "click here → this happens" is unmistakable. Mirrors the real TagAddPopover
 * look. Pure GSAP; non-interactive (the controller blocks the board underneath).
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
    const glow = q('[data-anim="glow"]')
    const menu = q('[data-anim="menu"]')
    const input = q('[data-anim="input"]')
    const chip = q('[data-anim="chip"]')
    const cursor = q('[data-anim="cursor"]')
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let tl: gsap.core.Timeline | null = null
    let raf = 0

    const run = (b: Box): void => {
      const menuLeft = Math.max(12, Math.min(b.left, window.innerWidth - MENU_W - 12))
      const menuTop = b.bottom + 8
      const cx = b.left + b.width / 2
      const cy = b.top + b.height / 2

      // place the glow exactly over the real +TAG button
      gsap.set(glow, { left: b.left - 8, top: b.top - 6, width: b.width + 16, height: b.height + 12, opacity: 0 })
      gsap.set(menu, { left: menuLeft, top: menuTop, opacity: 0, scale: 0.92, y: -4, transformOrigin: 'top left' })
      gsap.set(chip, { opacity: 0, scale: 0.7 })
      gsap.set(cursor, { left: cx + 70, top: cy + 64, opacity: 0, scale: 1 })

      if (reduce) {
        gsap.set(menu, { opacity: 1, scale: 1, y: 0 })
        gsap.set(chip, { opacity: 1, scale: 1 })
        gsap.set([glow, cursor], { opacity: 0 })
        setTyped(text.length)
        setCommitted(true)
        onApplyRef.current()
        raf = window.setTimeout(() => onFinishedRef.current(), 500) as unknown as number
        return
      }

      const counter = { v: 0 }
      tl = gsap.timeline()
      tl
        // 1) highlight the REAL +TAG button
        .to(glow, { opacity: 1, duration: 0.35, ease: 'power2.out' })
        .to(glow, { boxShadow: '0 0 0 4px rgba(40,241,0,0.4), 0 0 22px rgba(40,241,0,0.5)', scale: 1.08, duration: 0.55, yoyo: true, repeat: 1, ease: 'sine.inOut', transformOrigin: 'center' }, '<')
        .to(cursor, { opacity: 1, duration: 0.3, ease: 'power2.out' }, '<')
        // 2) cursor glides to the real +TAG and presses it (glow reacts)
        .to(cursor, { left: cx - 4, top: cy - 2, duration: 0.85, ease: 'power2.inOut' })
        .to(cursor, { scale: 0.74, duration: 0.13, yoyo: true, repeat: 1, ease: 'power1.inOut' })
        .to(glow, { scale: 0.9, duration: 0.13, yoyo: true, repeat: 1, transformOrigin: 'center' }, '<')
        // 3) the tag menu opens where the real popover would; cursor drops to the input
        .to(glow, { opacity: 0, duration: 0.3 })
        .to(menu, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(1.4)' }, '-=0.1')
        .to(cursor, { left: menuLeft + 42, top: menuTop + 46, duration: 0.5, ease: 'power2.inOut' }, '<')
        .to(input, { boxShadow: '0 0 0 3px rgba(40,241,0,0.3)', duration: 0.4, yoyo: true, repeat: 1, ease: 'sine.inOut' }, '<')
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
        // 6) hold so the chip + the real pill register, then hand off
        .to({}, { duration: 0.9 })
        .add(() => onFinishedRef.current())
    }

    // Measure the real +TAG one frame in (after the zoom has settled). Fall back
    // to a centered box if it can't be found, so the demo never gets stuck.
    raf = requestAnimationFrame(() => {
      const el = document.querySelector('[data-onboarding-target="card-tag"]')
      const r = el?.getBoundingClientRect()
      const box: Box = r && r.width > 0
        ? { left: r.left, top: r.top, width: r.width, height: r.height, bottom: r.bottom }
        : { left: window.innerWidth / 2 - 30, top: window.innerHeight / 2 - 12, width: 60, height: 24, bottom: window.innerHeight / 2 + 12 }
      run(box)
    })

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(raf)
      if (tl) tl.kill()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const shown = text.slice(0, typed)
  const stillTyping = typed < text.length

  return (
    <div ref={rootRef} className={styles.layer} data-testid="onboarding-tag-demo" aria-hidden="true">
      {/* green highlight that sits exactly over the REAL +TAG button */}
      <span data-anim="glow" className={styles.glow} />
      {/* the tag menu that opens where the real popover would (matches the real
          TagAddPopover: no "+ TAG" header — that lives on the card button). */}
      <div data-anim="menu" className={styles.menu}>
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
