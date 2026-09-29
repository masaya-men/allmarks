'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { makeCard } from '@/lib/marketing/lp/art'
import { masonry } from '@/lib/marketing/lp/masonry'
import { E } from '@/lib/marketing/lp/motion-math'
import { tweetKey } from '@/lib/marketing/lp/tweet-key'
import type { CardSpec } from '@/lib/marketing/lp/types'
import styles from './Problem.module.css'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

/**
 * Problem — the list-that-folds-into-a-board beat, ported from
 * docs/private/lp-v10-mock.html (markup 435–444, CSS 189–212 minus the
 * shared .rule/.h2 already in ../lp-art.css, motion 656–679 + label-line
 * tween 800, resize 861). Eight decorative list rows lose their text, fold
 * into one middle line, and a masonry board of cards opens from that line —
 * driven by a single scrubbed ScrollTrigger tied to page scroll.
 */

/** English design word — same in every locale, never `landing.problem.label` (mock line 437: literal "Problem" text node, no wrapper). */
const LABEL_TEXT = 'Problem'

/** English constant for the "AllMarks" chip (mock line 440, data-s="1"). Never translated. */
const CHIP_ALLMARKS = 'AllMarks'

/**
 * The board's 8 cards (mock PB array, line 660). `tw:0/1` map to `tweet:1/2`
 * (task-6 ruling) — text comes from landing.demo.tweet1/2 via tweetKey().
 */
const PROBLEM_CARDS: readonly CardSpec[] = [
  { art: 'halftone', a: 1 },
  { art: 'truchet', a: 4 / 5 },
  { tweet: 1, a: 1 },
  { art: 'ticker', a: 16 / 9 },
  { art: 'vinyl', a: 16 / 9 },
  { art: 'swiss', a: 1 },
  { tweet: 2, a: 4 / 5 },
  { art: 'grid', a: 1 },
]

/** Stacking order passed to masonry() — identity order, matching mock's `PB.map((_,i)=>i)`. */
const PROBLEM_ORDER: readonly number[] = PROBLEM_CARDS.map((_, i) => i)

/**
 * The 8 decorative list rows' bar widths (mock line 658:
 * `34+((r*37)%30)` / `12+((r*23)%12)`), precomputed once at module load.
 */
const ROW_BARS: readonly { readonly t: number; readonly u: number }[] = Array.from(
  { length: 8 },
  (_, r) => ({ t: 34 + ((r * 37) % 30), u: 12 + ((r * 23) % 12) }),
)

/** One row's 4 children, resolved once at mount (mock's `row.children[0..3]`) — avoids re-querying every scrub frame. */
type ProblemRowEls = {
  readonly row: HTMLDivElement
  readonly fv: HTMLElement
  readonly barT: HTMLElement
  readonly barU: HTMLElement
  readonly dot: HTMLElement
}

/** One board card slot, positioned by the Problem's own masonry layout (mock pCards). */
type ProblemBoardItem = {
  readonly el: HTMLDivElement
  readonly spec: CardSpec
  x: number
  y: number
  h: number
  col: number
}

export function Problem(): React.ReactElement {
  const { t } = useI18n()
  // Synced via its own effect (never written during render — react-hooks/refs,
  // task-6 ruling R21) so the mount-time effect below always sees the latest
  // translator without needing `t` in its dependency array (which would
  // restart the whole scrub/board setup on every locale swap) — same pattern
  // as Hero.tsx.
  const tRef = useRef(t)
  useEffect(() => {
    tRef.current = t
  }, [t])

  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const midRef = useRef<HTMLElement>(null)
  const sboardRef = useRef<HTMLDivElement>(null)
  const chip0Ref = useRef<HTMLSpanElement>(null)
  const chip1Ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    const stage = stageRef.current
    const list = listRef.current
    const mid = midRef.current
    const sboard = sboardRef.current
    const chip0 = chip0Ref.current
    const chip1 = chip1Ref.current
    if (!section || !stage || !list || !mid || !sboard || !chip0 || !chip1) return undefined

    // Resolve each row's 4 children once (mock's `row.children[0..3]`), from
    // list.children — mirrors the mock's own `[].slice.call(list.children)`,
    // so a remount can never duplicate rows (React owns them, not JS).
    const rowDivs = Array.from(list.children).filter(
      (el): el is HTMLDivElement => el instanceof HTMLDivElement,
    )
    const rowEls: ProblemRowEls[] = []
    for (const row of rowDivs) {
      const fv = row.children.item(0)
      const barT = row.children.item(1)
      const barU = row.children.item(2)
      const dot = row.children.item(3)
      if (fv instanceof HTMLElement && barT instanceof HTMLElement && barU instanceof HTMLElement && dot instanceof HTMLElement) {
        rowEls.push({ row, fv, barT, barU, dot })
      }
    }
    if (rowEls.length !== ROW_BARS.length) return undefined

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Row centre cache (mock's `row._cy`) — a plain array, never a DOM expando.
    const rowCenters: number[] = new Array(rowEls.length).fill(0)
    // Layout cache (mock's PG.H / PG.sbTop) — measured only in pLayout().
    let stageH = 0
    let sbTop = 0
    let currentP = reduce ? 1 : 0
    let disposed = false

    // ── board: 8 cards, imperative like Hero's (mock 661) ──
    const pCards: ProblemBoardItem[] = PROBLEM_CARDS.map((spec) => {
      const el = makeCard(spec, {
        amb: false,
        tweetText: spec.tweet != null ? tRef.current(tweetKey(spec.tweet)) : undefined,
      })
      sboard.appendChild(el)
      return { el, spec, x: 0, y: 0, h: 0, col: 0 }
    })

    // Layout reads (clientWidth/clientHeight/offsetTop) happen only here —
    // called at init, from the debounced resize handler, and once fonts
    // settle (R11/R13), never per scrub frame.
    function pLayout(): void {
      const W = sboard!.clientWidth
      const n = W < 520 ? 2 : 4
      const gap = W < 520 ? 8 : 10
      const L = masonry(PROBLEM_CARDS, PROBLEM_ORDER, W, n, gap)
      pCards.forEach((c, i) => {
        const slot = L.slots[i]
        c.el.style.width = `${L.cw}px`
        c.el.style.height = `${slot.h}px`
        c.x = slot.x
        c.y = slot.y
        c.h = slot.h
        c.col = Math.round(slot.x / (L.cw + 1))
      })
      stageH = stage!.clientHeight
      sbTop = sboard!.offsetTop
      rowEls.forEach((r, i) => {
        r.row.style.transform = ''
        rowCenters[i] = r.row.offsetTop + r.row.offsetHeight / 2 + list!.offsetTop
      })
    }

    // Writes transform/opacity/clip-path/visibility only, from cached
    // numbers — safe to call every scrub frame (mock renderProb, line 668).
    function renderProb(p: number): void {
      currentP = p
      const cy = stageH / 2
      rowEls.forEach((r, i) => {
        const a = E(p, 0.02 + i * 0.01, 0.14 + i * 0.01)
        r.fv.style.opacity = String(1 - a)
        r.barT.style.transform = `scaleX(${1 - a * 0.92})`
        r.barU.style.transform = `scaleX(${1 - a})`
        r.dot.style.transform = `scaleX(${1 - a})`
        const b = E(p, 0.15 + Math.abs(i - 3.5) * 0.008, 0.32)
        const ry = rowCenters[i] ?? 0
        r.row.style.transform = `translateY(${(cy - ry) * b}px) scaleY(${1 - b})`
        r.row.style.opacity = String(1 - E(p, 0.28, 0.34))
      })
      mid!.style.transform = `scaleX(${E(p, 0.22, 0.34) * (1 - E(p, 0.5, 0.6))})`
      pCards.forEach((c) => {
        const o = E(p, 0.34 + c.col * 0.04, 0.56 + c.col * 0.04)
        const ccy = sbTop + c.y + c.h / 2
        const dy = (cy - ccy) * (1 - o) * 0.5
        const inset = (50 * (1 - o)).toFixed(2)
        c.el.style.transform = `translate(${c.x}px, ${c.y + dy}px)`
        c.el.style.clipPath = `inset(${inset}% 0 ${inset}% 0 round 12px)`
        c.el.style.visibility = o > 0.001 ? 'visible' : 'hidden'
      })
      const chip1On = p > 0.45
      chip0!.classList.toggle(styles.on, !chip1On)
      chip1!.classList.toggle(styles.on, chip1On)
    }

    pLayout()
    renderProb(currentP)

    // ── scrub trigger + label-line tween (R16): reduced motion gets neither
    //    — renderProb(1) above already drew the final "board open" state,
    //    and the label line stays at its CSS default (fully drawn, no
    //    scaleX(0) is ever applied) (mock 798/800, guarded by motionOK). ──
    let ctx: ReturnType<typeof gsap.context> | undefined
    if (!reduce) {
      ctx = gsap.context(() => {
        const px = { p: 0 }
        gsap.to(px, {
          p: 1,
          ease: 'none',
          onUpdate: () => renderProb(px.p),
          scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: 0.5 },
        })

        const labelLn = section.querySelector<HTMLElement>('.label .ln')
        if (labelLn) {
          gsap.fromTo(
            labelLn,
            { scaleX: 0 },
            {
              scaleX: 1,
              duration: 0.8,
              ease: 'expo.out',
              scrollTrigger: { trigger: labelLn, start: 'top 85%', toggleActions: 'play none none reverse' },
            },
          )
        }
      }, sectionRef)
    }

    // ── resize (R13): debounced 160ms, re-measure then redraw at the last
    //    known progress. Also re-run once per-locale fonts settle, since
    //    that can reflow the text column after init. Both guarded by
    //    `disposed` so neither can fire after unmount. ──
    function relayout(): void {
      if (disposed) return
      pLayout()
      renderProb(currentP)
    }

    let resizeTimer: number | undefined
    const onResize = (): void => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(relayout, 160)
    }
    window.addEventListener('resize', onResize)

    if (document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        relayout()
      })
    }

    return () => {
      disposed = true
      ctx?.revert()
      window.clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      pCards.forEach((c) => c.el.remove())
    }
  }, [])

  const headlineLines = t('landing.problem.headline').split('\n')
  const headlineNodes = headlineLines.flatMap((line, i) =>
    i === 0
      ? [<span data-lp-text key="h0">{line}</span>]
      : [<br key={`hbr${i}`} />, <span data-lp-text key={`h${i}`}>{line}</span>],
  )

  return (
    <section ref={sectionRef} id="problem" className={styles.problem}>
      <div className={styles.sticky}>
        <div className={`wrap ${styles.pgrid}`}>
          <div>
            <p className="label">
              <i className="ln" />
              {LABEL_TEXT}
            </p>
            <h2 className="h2">{headlineNodes}</h2>
            <p className="body" data-lp-text>
              {t('landing.problem.body')}
            </p>
            <div className={styles.chips}>
              <span ref={chip0Ref} className={`${styles.chip} ${styles.on}`} data-s="0" data-lp-text>
                {t('landing.problem.chipList')}
              </span>
              <span ref={chip1Ref} className={styles.chip} data-s="1" data-lp-text>
                {CHIP_ALLMARKS}
              </span>
            </div>
          </div>

          <div ref={stageRef} className={styles.stage} aria-hidden="true">
            <div ref={listRef} className={styles.list}>
              {ROW_BARS.map((bar, i) => (
                <div className={styles.lrow} key={i}>
                  <i className={styles.fv} />
                  <i className={styles.t} style={{ width: `${bar.t}%` }} />
                  <i className={styles.u} style={{ width: `${bar.u}%` }} />
                  <i className={styles.d} />
                </div>
              ))}
            </div>
            <i ref={midRef as React.RefObject<HTMLElement>} className={styles.mid} />
            <div ref={sboardRef} className={styles.sboard} data-problem-board />
          </div>
        </div>
      </div>
    </section>
  )
}
