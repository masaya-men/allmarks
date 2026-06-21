// components/onboarding/ExtensionXSaveReenactment.tsx
'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { gsap } from 'gsap'
import { PILL_ICONS, applyPillState } from './extension-pill'
import frame from './ExtensionSaveReenactment.module.css'
import x from './ExtensionXSaveReenactment.module.css'
import './extension-ui.css'

type Props = {
  readonly caption: string
  readonly buttonLabel: string
  readonly onAdvance: () => void
}

/**
 * ⑤ extension demo, beat 2 — the famous-site integration (I-05). In a browser
 * frame on a stylised X (Twitter) timeline, the green demo cursor presses the
 * post's BOOKMARK button; that fires the very thing the real extension does on X
 * (extension/twitter.js hooks data-testid="bookmark"/"like"): the genuine
 * AllMarks cursor pill runs Saving → Saved. So the user sees "tap Bookmark on X
 * and it lands in AllMarks too." No real X logo is used — the action icons are
 * generic line glyphs (X's mark is a trademark); the AllMarks pill IS the real
 * extension UI (extension-ui.css). Pure GSAP timing; loops + pulses NEXT.
 */
export function ExtensionXSaveReenactment({ caption, buttonLabel, onAdvance }: Props): ReactElement {
  const vpRef = useRef<HTMLDivElement>(null)
  const [cuePulse, setCuePulse] = useState(false)

  useEffect(() => {
    const vp = vpRef.current
    if (!vp) return
    const q = <T extends HTMLElement>(sel: string): T | null => vp.querySelector<T>(sel)
    const bm = q('[data-anim="bm"]')
    const pill = q('[data-anim="pill"]')
    const pillIcon = q<HTMLElement>('[data-anim="pill"] [data-role="icon"]')
    const pillState = q<HTMLElement>('[data-anim="pill"] [data-role="state"]')
    const cursor = q('[data-anim="cursor"]')
    if (!bm || !pill || !pillIcon || !pillState || !cursor) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let labelTimers: number[] = []
    const clearLabels = (): void => { labelTimers.forEach(clearTimeout); labelTimers = [] }
    const push = (t: number[]): void => { labelTimers.push(...t) }

    // center of an element relative to the viewport box (for cursor targeting)
    const rel = (el: HTMLElement): { x: number; y: number } => {
      const r = el.getBoundingClientRect()
      const v = vp.getBoundingClientRect()
      return { x: r.left - v.left + r.width / 2, y: r.top - v.top + r.height / 2 }
    }
    const vw = (): number => vp.getBoundingClientRect().width
    const vh = (): number => vp.getBoundingClientRect().height

    const reset = (): void => {
      clearLabels()
      pill.classList.remove('is-visible')
      pill.setAttribute('data-state', '')
      pillIcon.innerHTML = ''
      pillState.textContent = ''
      bm.setAttribute('data-on', 'false')
      gsap.set(cursor, { left: vw() * 0.2, top: vh() * 0.85, scale: 1, opacity: 0 })
    }

    const showPill = (): void => {
      const b = rel(bm)
      gsap.set(pill, { left: Math.max(8, b.x - 150), top: Math.max(8, b.y - 62) })
      pill.classList.add('is-visible')
    }

    if (reduce) {
      bm.setAttribute('data-on', 'true')
      showPill()
      pill.setAttribute('data-state', 'saved')
      pillIcon.innerHTML = PILL_ICONS.check
      pillState.textContent = 'Saved'
      gsap.set(cursor, { opacity: 0 })
      setCuePulse(true)
      return
    }

    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.0, onRepeat: () => setCuePulse(true) })
    tl
      .call(reset)
      .to(cursor, { opacity: 1, duration: 0.3, ease: 'power2.out' })
      // glide to the bookmark button and press it
      .to(cursor, { left: () => rel(bm).x - 4, top: () => rel(bm).y - 2, duration: 1.0, ease: 'power2.inOut' }, '+=0.15')
      .to(cursor, { scale: 0.78, duration: 0.13, yoyo: true, repeat: 1, ease: 'power1.inOut' })
      // X marks it bookmarked + the AllMarks pill appears running "Saving"
      .call(() => {
        bm.setAttribute('data-on', 'true')
        showPill()
        push(applyPillState(pill, pillIcon, pillState, 'saving'))
      })
      .to({}, { duration: 0.95 }) // hold "Saving"
      // save lands: pill morphs to "Saved" (green check + glitch)
      .call(() => push(applyPillState(pill, pillIcon, pillState, 'saved')))
      .to({}, { duration: 1.1 })
      // pill auto-hides (real saved autoHide), hold the bookmarked state
      .call(() => pill.classList.remove('is-visible'))
      .to({}, { duration: 1.3 })

    return () => { tl.kill(); clearLabels() }
  }, [])

  return (
    <div className={frame.stage} data-testid="stage-extX">
      <div className={frame.browser}>
        <div className={frame.chrome}>
          <span className={frame.close} aria-hidden="true" />
          <span className={frame.urlbar}>x.com</span>
        </div>
        <div ref={vpRef} className={frame.viewport}>
          {/* stylised X timeline — a single post (no real X branding) */}
          <div className={x.xpage}>
            <article className={x.tweet}>
              <div className={x.head}>
                <span className={x.avatar} aria-hidden="true" />
                <div className={x.who}>
                  <span className={x.name}>studio notes</span>
                  <span className={x.handle}>@studionotes</span>
                </div>
              </div>
              <p className={x.body}>this palette is unreal — saving it before it disappears into the feed.</p>
              <div className={x.actions}>
                <button type="button" className={x.action} tabIndex={-1} aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4 3.5V15H5.5A1.5 1.5 0 0 1 4 13.5z" /></svg>
                </button>
                <button type="button" className={x.action} tabIndex={-1} aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M7 5 4 8l3 3" /><path d="M4 8h11a3 3 0 0 1 3 3v1" /><path d="M17 19l3-3-3-3" /><path d="M20 16H9a3 3 0 0 1-3-3v-1" /></svg>
                </button>
                <button type="button" className={x.action} tabIndex={-1} aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M12 20s-7-4.6-7-9.6A3.4 3.4 0 0 1 12 8a3.4 3.4 0 0 1 7 2.4C19 15.4 12 20 12 20z" /></svg>
                </button>
                {/* BOOKMARK — the button the cursor presses; fills when saved */}
                <button type="button" className={`${x.action} ${x.bm}`} data-anim="bm" data-on="false" tabIndex={-1} aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M6 4h12v16l-6-4-6 4z" /></svg>
                </button>
                <button type="button" className={x.action} tabIndex={-1} aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M12 3v11" /><path d="M8 6l4-3 4 3" /><path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" /></svg>
                </button>
              </div>
            </article>
          </div>

          {/* REAL cursor pill (extension UI) — the AllMarks save confirmation */}
          <div data-anim="pill" className="booklage-pill" data-state="" aria-hidden="true">
            <span className="booklage-pill__icon" data-role="icon" />
            <span className="booklage-pill__brand">AllMarks</span>
            <span className="booklage-pill__sep">·</span>
            <span className="booklage-pill__state" data-role="state">Saving</span>
          </div>

          <span data-anim="cursor" className={frame.cursor} aria-hidden="true" />
        </div>
      </div>
      <p className={frame.caption}>{caption}</p>
      <button
        type="button"
        className={frame.cta}
        data-cue={cuePulse ? 'true' : undefined}
        onClick={onAdvance}
      >
        {buttonLabel}
      </button>
    </div>
  )
}
