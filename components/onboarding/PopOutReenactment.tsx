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

// Two demo cards so the meter ticks 01 → 02 as saves accumulate in the popped-out
// companion, mirroring the real PiP carousel (new saves append at the RIGHT end +
// auto-scroll the newest to centre). The last (active/centred) card carries the
// "+ TAG" affordance the cursor taps.
const DEMO_CARDS = [
  { id: 'card0', title: 'design ref' },
  { id: 'card1', title: 'article' },
] as const

const pad = (n: number): string => String(n).padStart(2, '0')

/**
 * POP OUT (Document Picture-in-Picture) re-enactment — a faithful visual
 * facsimile built like ExtensionSaveReenactment: a fake browser on a real LP
 * screenshot, with a green cursor that auto-drives the demo. The cursor presses
 * the POP OUT control, a small companion window pops out, saved cards GLIDE IN
 * FROM THE RIGHT and settle at centre (ease-out quart / 0.7s = the real PipStack
 * auto-scroll) while an always-on meter ticks current/total, and the cursor taps
 * "+ TAG" so a tag chip lights. Does NOT open real PiP and does NOT import
 * PipStack/PipCompanion — pure GSAP + CSS. Loops; pulses NEXT after pass 1.
 */
export function PopOutReenactment({ caption, buttonLabel, onAdvance }: Props): ReactElement {
  const vpRef = useRef<HTMLDivElement>(null)
  const [count, setCount] = useState<number>(0)
  const [cuePulse, setCuePulse] = useState<boolean>(false)

  useEffect((): (() => void) | undefined => {
    const vp = vpRef.current
    if (!vp) return undefined
    const q = <T extends HTMLElement>(sel: string): T | null => vp.querySelector<T>(sel)
    const popBtn = q('[data-anim="popoutBtn"]')
    const pip = q('[data-anim="pip"]')
    const tagBtn = q('[data-anim="tagBtn"]')
    const chip = q('[data-anim="chip"]')
    const cursor = q('[data-anim="cursor"]')
    const pasteUrl = q('[data-anim="pasteUrl"]')
    const pasteFlash = q('[data-anim="pasteFlash"]')
    const cards = Array.from(vp.querySelectorAll<HTMLElement>('[data-anim^="card"]'))
    if (!popBtn || !pip || !tagBtn || !chip || !cursor || !pasteUrl || !pasteFlash || cards.length < 2) return undefined

    // centre of an element relative to the viewport box (for cursor targeting)
    const rel = (el: HTMLElement): { x: number; y: number } => {
      const r = el.getBoundingClientRect()
      const v = vp.getBoundingClientRect()
      return { x: r.left - v.left + r.width / 2, y: r.top - v.top + r.height / 2 }
    }
    const vw = (): number => vp.getBoundingClientRect().width
    const vh = (): number => vp.getBoundingClientRect().height
    // top-centre of the popped-out window — where a pasted link lands
    const pipPoint = (): { x: number; y: number } => {
      const r = pip.getBoundingClientRect()
      const v = vp.getBoundingClientRect()
      return { x: r.left - v.left + r.width / 2, y: r.top - v.top + r.height * 0.32 }
    }

    const reset = (): void => {
      gsap.set(pip, { scale: 0.5, opacity: 0, transformOrigin: '85% 8%' })
      gsap.set(cards, { xPercent: 260, opacity: 0 })
      chip.setAttribute('data-on', 'false')
      gsap.set(pasteUrl, { xPercent: -50, y: -8, scale: 0.9, opacity: 0 })
      gsap.set(pasteFlash, { xPercent: -50, yPercent: -50, scale: 0.4, opacity: 0 })
      gsap.set(cursor, { left: vw() * 0.22, top: vh() * 0.84, scale: 1, opacity: 0 })
      setCount(0)
    }

    const reduce =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false

    if (reduce) {
      // Static end state: window popped, both cards centred (last on top),
      // meter full, tag chip lit, cursor hidden.
      gsap.set(pip, { scale: 1, opacity: 1 })
      gsap.set(cards[0], { xPercent: -112, opacity: 1 })
      gsap.set(cards[1], { xPercent: 0, opacity: 1 })
      chip.setAttribute('data-on', 'true')
      gsap.set([pasteUrl, pasteFlash], { opacity: 0 })
      gsap.set(cursor, { opacity: 0 })
      setCount(2)
      setCuePulse(true)
      return undefined
    }

    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.0, onRepeat: () => setCuePulse(true) })
    tl.call(reset)
      .to(cursor, { opacity: 1, duration: 0.3, ease: 'power2.out' })
      // cursor glides to the POP OUT control and presses it
      .to(cursor, { left: () => rel(popBtn).x, top: () => rel(popBtn).y, duration: 0.9, ease: 'power2.inOut' }, '+=0.1')
      .to(cursor, { scale: 0.78, duration: 0.13, yoyo: true, repeat: 1, ease: 'power1.inOut' })
      // the companion window pops out
      .to(pip, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.5)' }, '-=0.05')
      .to({}, { duration: 0.2 })
      // cursor rests over the companion window; a link is pasted straight into it
      .to(cursor, { left: () => pipPoint().x, top: () => pipPoint().y, duration: 0.5, ease: 'power2.inOut' })
      .to(cursor, { scale: 0.8, duration: 0.11, yoyo: true, repeat: 1, ease: 'power1.inOut' })
      // the pasted URL lands + a flash confirms the save (no extension / bookmarklet)
      .to(pasteUrl, { y: 0, scale: 1, opacity: 1, duration: 0.34, ease: 'back.out(2)' }, '-=0.05')
      .fromTo(pasteFlash, { scale: 0.4, opacity: 0.85 }, { scale: 1.5, opacity: 0, duration: 0.55, ease: 'power2.out' }, '-=0.1')
      // the pasted link becomes the first saved card → glides in from the right
      .to(cards[0], { xPercent: 0, opacity: 1, duration: 0.7, ease: 'power4.out' }, '-=0.15')
      .to(pasteUrl, { opacity: 0, duration: 0.3 }, '<')
      .call(() => setCount(1))
      .to({}, { duration: 0.7 })
      // card 2 arrives; card 1 slides left out of the way (carousel advances)
      .to(cards[0], { xPercent: -112, duration: 0.7, ease: 'power4.out' }, 'in2')
      .to(cards[1], { xPercent: 0, opacity: 1, duration: 0.7, ease: 'power4.out' }, 'in2')
      .call(() => setCount(2))
      .to({}, { duration: 0.55 })
      // cursor taps "+ TAG" on the active card → a tag chip lights green
      .to(cursor, { left: () => rel(tagBtn).x, top: () => rel(tagBtn).y, duration: 0.6, ease: 'power2.inOut' })
      .to(cursor, { scale: 0.8, duration: 0.11, yoyo: true, repeat: 1 })
      .call(() => chip.setAttribute('data-on', 'true'))
      .to({}, { duration: 1.6 })

    return () => { tl.kill() }
  }, [])

  return (
    <div className={styles.stage} data-testid="stage-popout-demo">
      <div className={styles.browser}>
        <div className={styles.chrome}>
          <span className={styles.close} aria-hidden="true" />
          <span className={styles.urlbar}>allmarks.app</span>
        </div>
        <div ref={vpRef} className={styles.viewport}>
          {/* the "real screen" — a screenshot of AllMarks being used */}
          <img className={styles.page} src="/onboarding/lp-hero-shot.webp" alt="" draggable={false} />

          {/* board nav overlay carrying the real POP OUT control */}
          <div className={styles.nav} aria-hidden="true">
            <span className={styles.navItem}>SETTINGS</span>
            <span data-anim="popoutBtn" className={styles.popoutBtn}>
              <span className={styles.navDot} />POP OUT
            </span>
            <span className={styles.navItem}>SHARE</span>
          </div>

          {/* the companion window that pops out */}
          <div data-anim="pip" className={styles.pip} aria-hidden="true">
            <div className={styles.pipBar}><span className={styles.dot} />POP OUT</div>
            {/* a link pasted straight into the companion window → the first saved card */}
            <span data-anim="pasteFlash" className={styles.pasteFlash} />
            <span data-anim="pasteUrl" className={styles.pasteUrl}>youtu.be/dQw4…</span>
            <div className={styles.carousel}>
              {DEMO_CARDS.map((c, i) => (
                <div key={c.id} data-anim={`card${i}`} className={styles.card}>
                  <div className={styles.cardThumb} />
                  <div className={styles.cardTitle}>{c.title}</div>
                  {i === DEMO_CARDS.length - 1 && (
                    <>
                      <span data-anim="tagBtn" className={styles.tagBtn}>+ TAG</span>
                      <span data-anim="chip" className={styles.chip} data-on="false">design</span>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className={styles.meter}>
              <span className={styles.meterText}>{pad(count)} / {pad(count)}</span>
            </div>
          </div>

          <span data-anim="cursor" className={styles.cursor} aria-hidden="true" />
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
