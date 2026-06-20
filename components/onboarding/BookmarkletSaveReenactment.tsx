// components/onboarding/BookmarkletSaveReenactment.tsx
'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { gsap } from 'gsap'
import { SaveToastFace, type FaceState } from '@/components/bookmarklet/SaveToastFace'
import styles from './BookmarkletSaveReenactment.module.css'

type Props = {
  readonly caption: string
  readonly buttonLabel: string
  readonly onAdvance: () => void
}

// Neutral dummy bookmarks so the bar reads as a real toolbar without borrowing
// any other brand. The AllMarks one is the live bookmarklet being demonstrated.
const DUMMY_BOOKMARKS = ['Docs', 'Mail', 'News'] as const
// Suggested tags the cursor lights up — the same ✓-green vocabulary the app
// uses everywhere for "applied".
const TAG_CHIPS = ['design', 'video', 'inspo'] as const

/** Thin-line bookmark glyph — matches the board chrome + BookmarkletInstallChip. */
function BookmarkGlyph(): ReactElement {
  return (
    <svg className={styles.bmIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3.5 h12 a1 1 0 0 1 1 1 v16.2 a0.6 0.6 0 0 1 -0.93 0.5 L12 17.6 l-6.07 3.6 A0.6 0.6 0 0 1 5 20.7 V4.5 a1 1 0 0 1 1 -1 z" />
    </svg>
  )
}

/**
 * ⑥ install — beat 1: a faithful re-enactment of saving with the bookmarklet.
 * On a screenshot of a real page (a browser frame whose BOOKMARK BAR holds the
 * AllMarks bookmarklet), the cursor clicks the bookmarklet → the REAL save
 * window pops (the genuine SaveToastFace running Saving → Saved with the ring,
 * checkmark draw, wordmark and staggered label) → it switches to a tag mode
 * where suggested chips light green. Pure GSAP drives the cursor + window-open.
 *
 * Fidelity scope: only the Saving → Saved FACE is drift-locked — SaveToastFace
 * shares SaveToast.module.css with the real /save window, so its look can't
 * diverge. The tag mode below is an intentional STYLIZED FACSIMILE (the real
 * tag UI is the interactive <TagAddPopover>, which isn't reproduced in a
 * decorative aria-hidden re-enactment); its chips/header are demo-local styles
 * and may differ from the live window's tag mode by design.
 *
 * The cursor travels the whole browser frame (bar → page), so the animation
 * root is `.browser`, not the page viewport. Loops; pulses NEXT after the first
 * pass. Mirrors ExtensionSaveReenactment (the ⑤ extension demo).
 */
export function BookmarkletSaveReenactment({ caption, buttonLabel, onAdvance }: Props): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null)
  const [faceState, setFaceState] = useState<FaceState>('saving')
  const [showTag, setShowTag] = useState(false)
  const [chipsOn, setChipsOn] = useState<number[]>([])
  const [cuePulse, setCuePulse] = useState(false)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const q = <T extends HTMLElement>(sel: string): T | null => root.querySelector<T>(sel)
    const bm = q('[data-anim="bm"]')
    const popup = q('[data-anim="popup"]')
    const scrim = q('[data-anim="scrim"]')
    const cursor = q('[data-anim="cursor"]')
    const chips = Array.from(root.querySelectorAll<HTMLElement>('[data-anim^="chip"]'))
    if (!bm || !popup || !scrim || !cursor || chips.length < 2) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // center of an element in the .browser coordinate box (the cursor lives in
    // .browser so it can move between the bookmark bar and the page popup)
    const rel = (el: HTMLElement): { x: number; y: number } => {
      const r = el.getBoundingClientRect()
      const b = root.getBoundingClientRect()
      return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 }
    }
    const bw = (): number => root.getBoundingClientRect().width
    const bh = (): number => root.getBoundingClientRect().height

    const reset = (): void => {
      gsap.set(popup, { opacity: 0, scale: 0.7, transformOrigin: '50% 0%' })
      gsap.set(scrim, { opacity: 0 })
      gsap.set(cursor, { left: bw() * 0.2, top: bh() * 0.84, scale: 1, opacity: 0 })
      bm.setAttribute('data-hover', 'false')
      setFaceState('saving')
      setShowTag(false)
      setChipsOn([])
    }

    if (reduce) {
      // Static end state — window open, saved + tagged, no animation.
      gsap.set(popup, { opacity: 1, scale: 1 })
      gsap.set(scrim, { opacity: 1 })
      gsap.set(cursor, { opacity: 0 })
      setFaceState('saved')
      setShowTag(true)
      setChipsOn([0, 1])
      setCuePulse(true)
      return
    }

    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.9, onRepeat: () => setCuePulse(true) })
    tl
      .call(reset)
      .to(cursor, { opacity: 1, duration: 0.3, ease: 'power2.out' })
      // glide up to the AllMarks bookmarklet in the bar and press it
      .to(cursor, { left: () => rel(bm).x, top: () => rel(bm).y, duration: 0.95, ease: 'power2.inOut' }, '+=0.1')
      .call(() => bm.setAttribute('data-hover', 'true'))
      .to(cursor, { scale: 0.8, duration: 0.12, yoyo: true, repeat: 1, ease: 'power1.inOut' })
      // the save window opens (scales out toward the page) running "Saving"
      .call(() => { bm.setAttribute('data-hover', 'false'); setFaceState('saving') })
      .to(popup, { opacity: 1, scale: 1, duration: 0.42, ease: 'back.out(1.5)' })
      .to(scrim, { opacity: 1, duration: 0.3 }, '<')
      .to({}, { duration: 0.95 }) // hold "Saving"
      // save lands → checkmark draws, label morphs to "Saved"
      .call(() => setFaceState('saved'))
      .to({}, { duration: 0.85 }) // savor "Saved"
      // window switches to its tag mode (suggested chips)
      .call(() => setShowTag(true))
      .to({}, { duration: 0.5 }) // let the crossfade play
      // cursor lights the first chip…
      .to(cursor, { left: () => rel(chips[0]).x, top: () => rel(chips[0]).y, duration: 0.6, ease: 'power2.inOut' })
      .to(cursor, { scale: 0.8, duration: 0.11, yoyo: true, repeat: 1 })
      .call(() => setChipsOn([0]))
      // …and the second
      .to(cursor, { left: () => rel(chips[1]).x, top: () => rel(chips[1]).y, duration: 0.5, ease: 'power2.inOut' }, '+=0.1')
      .to(cursor, { scale: 0.8, duration: 0.11, yoyo: true, repeat: 1 })
      .call(() => setChipsOn([0, 1]))
      .to({}, { duration: 1.6 }) // hold the saved + tagged window

    return () => { tl.kill() }
  }, [])

  return (
    <div className={styles.stage} data-testid="stage-install-demo">
      <div ref={rootRef} className={styles.browser}>
        <div className={styles.chrome}>
          <span className={styles.close} aria-hidden="true" />
          <span className={styles.urlbar}>allmarks.app</span>
        </div>
        <div className={styles.bookmarkBar} aria-hidden="true">
          <span data-anim="bm" className={`${styles.bm} ${styles.bmAll}`} data-hover="false">
            <BookmarkGlyph />
            <span className={styles.bmText}>AllMarks</span>
          </span>
          {DUMMY_BOOKMARKS.map((b) => (
            <span key={b} className={styles.bm}>
              <span className={styles.bmDot} />
              <span className={styles.bmText}>{b}</span>
            </span>
          ))}
        </div>

        <div className={styles.viewport}>
          {/* the "real page" being viewed — the same LP screenshot ⑤ uses */}
          <img className={styles.page} src="/onboarding/lp-hero-shot.webp" alt="" draggable={false} />
          <div data-anim="scrim" className={styles.scrim} />

          {/* the save window popup — real save face + real tag mode */}
          <div data-anim="popup" className={styles.popup} aria-hidden="true">
            {/* confirmation face (Saving → Saved) */}
            <div className={styles.layer} data-show={showTag ? 'false' : 'true'}>
              <SaveToastFace state={faceState} style={{ position: 'absolute' }} />
            </div>
            {/* tag mode — stylized facsimile (see fidelity note in the JSDoc):
                the real tag UI is the interactive <TagAddPopover>, not reproduced here */}
            <div className={`${styles.layer} ${styles.tagLayer}`} data-show={showTag ? 'true' : 'false'}>
              <div className={styles.tagHead}>
                <svg className={styles.tagCheck} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12 L10 17 L19 7" />
                </svg>
                <div className={styles.tagHeadText}>
                  <span className={styles.tagBrand}>AllMarks</span>
                  <span className={styles.tagSaved}>Saved</span>
                </div>
              </div>
              <div className={styles.tagPrompt}>Add a tag</div>
              <div className={styles.chips}>
                {TAG_CHIPS.map((tag, i) => (
                  <span
                    key={tag}
                    data-anim={`chip${i}`}
                    className={styles.chip}
                    data-on={chipsOn.includes(i) ? 'true' : 'false'}
                  >
                    <span className={styles.chipCheck}>
                      <svg viewBox="0 0 24 24"><path d="M5 12 L10 17 L19 7" /></svg>
                    </span>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* cursor lives in .browser so it can travel bar → page */}
        <span data-anim="cursor" className={styles.cursor} aria-hidden="true" />
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
