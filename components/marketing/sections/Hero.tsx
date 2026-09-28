'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { gsap } from 'gsap'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { makeCard, createStepRunner } from '@/lib/marketing/lp/art'
import type { CardSpec } from '@/lib/marketing/lp/types'
import styles from './Hero.module.css'

/**
 * Hero — signature landing section, ported from docs/private/lp-v10-mock.html
 * (markup 413–434, CSS 64–114 / 366 / hero+paste parts of 370–404, motion
 * 632–655 + 811–834). The intro line, headline, live paste→save board demo
 * and scroll cue. See Hero.module.css for the pre-hydration safety net that
 * keeps the static-export shell from flashing the finished state.
 */

/** English design word — same in every locale (R9). Never `landing.hero.label`. */
const LABEL_TEXT = 'Visual Bookmark Manager'

/** English design word for the scroll cue's rolling word (mock line 432). */
const SCROLL_WORD = 'Scroll'

/**
 * The hero board's 14 cards (mock HERO array, line 633). `tw:0/1/2` map to
 * `tweet:1/2/3` (R8) — the mock has three tweet cards, not two.
 */
const HERO_CARDS: readonly CardSpec[] = [
  { art: 'halftone', a: 3 / 4 },
  { tweet: 1, a: 1 },
  { art: 'truchet', a: 1 },
  { art: 'ticker', a: 16 / 9 },
  { art: 'vinyl', a: 1 },
  { tweet: 2, a: 1 },
  { art: 'swiss', a: 3 / 4 },
  { art: 'dither', a: 3 / 4 },
  { art: 'bars', a: 4 / 5 },
  { art: 'arches', a: 4 / 5 },
  { tweet: 3, a: 1 },
  { art: 'grid', a: 4 / 5 },
  { art: 'rules', a: 3 / 4 },
  { art: 'tag', a: 3 / 4 },
]

/** Precomputed hairline tick positions/delays along the scroll-cue track (mock line 432). */
const HERO_TICKS: readonly { readonly left: number; readonly delay: number }[] = [
  { left: 0, delay: 0 },
  { left: 14.2857, delay: 0.261 },
  { left: 28.5714, delay: 0.521 },
  { left: 42.8571, delay: 0.782 },
  { left: 57.1429, delay: 1.042 },
  { left: 71.4286, delay: 1.303 },
  { left: 85.7143, delay: 1.563 },
  { left: 100, delay: 1.824 },
]

/** One card slot positioned by the hero's own masonry-ish column layout. */
type HeroBoardItem = { readonly el: HTMLDivElement; readonly s: CardSpec; x: number; y: number; h: number }

/** Cached layout metrics (mock M) — recomputed only at init/resize (R11), never per frame. */
type HeroBoardMetrics = { n: number; gap: number; cw: number; visH: number }

function tweetTextFor(spec: CardSpec, t: (key: string) => string): string | undefined {
  if (spec.tweet === 1) return t('landing.demo.tweet1')
  if (spec.tweet === 2) return t('landing.demo.tweet2')
  if (spec.tweet === 3) return t('landing.demo.tweet3')
  return undefined
}

export function Hero(): React.ReactElement {
  const { t } = useI18n()
  // Read on every render so the mount-time effect below always sees the
  // latest translator without needing `t` in its dependency array (which
  // would restart the whole intro/board-demo animation on every locale swap).
  const tRef = useRef(t)
  tRef.current = t

  const sectionRef = useRef<HTMLElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const pasteRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<HTMLElement>(null)
  const cropRef = useRef<HTMLDivElement>(null)
  const leadRef = useRef<HTMLParagraphElement>(null)
  const ctasRef = useRef<HTMLDivElement>(null)
  const hruleBaseRef = useRef<HTMLElement>(null)
  const scueRef = useRef<HTMLSpanElement>(null)
  const heroReadyRef = useRef(false)

  const [modKey, setModKey] = useState<'Ctrl' | '⌘'>('Ctrl')

  // Mac/iOS paste-shortcut label (mock line 529).
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) {
      setModKey('⌘')
    }
  }, [])

  const handleSeeHow = (): void => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById('features')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
  }

  useEffect(() => {
    const section = sectionRef.current
    const board = boardRef.current
    const panel = panelRef.current
    const paste = pasteRef.current
    const line = lineRef.current
    const crop = cropRef.current
    const lead = leadRef.current
    const ctas = ctasRef.current
    const hruleBase = hruleBaseRef.current
    const scue = scueRef.current
    if (!section || !board || !panel || !paste || !line || !crop || !lead || !ctas || !hruleBase || !scue) {
      return undefined
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const root = section.closest<HTMLElement>('.lpRoot.lpHome')
    const header = root?.querySelector<HTMLElement>(':scope > header') ?? null
    const bggridLines = root ? Array.from(root.querySelectorAll<HTMLElement>('[data-lp-bggrid] i')) : []

    // ── board: 14 cards, masonry-ish columns, ambient art (mock 625–641) ──
    const steps = createStepRunner()
    const hItems: HeroBoardItem[] = HERO_CARDS.map((spec) => {
      const el = makeCard(spec, { amb: true, tweetText: tweetTextFor(spec, tRef.current), steps })
      board.appendChild(el)
      return { el, s: spec, x: 0, y: 0, h: 0 }
    })

    let cols: HeroBoardItem[][] = []
    let M: HeroBoardMetrics = { n: 4, gap: 10, cw: 0, visH: 0 }

    // Layout reads (clientWidth/clientHeight) happen only here — called at
    // init and from the debounced resize handler (R11), never per frame.
    function hMetrics(): HeroBoardMetrics {
      const W = board!.clientWidth
      const n = W < 420 ? 2 : W < 700 ? 3 : 4
      const gap = W < 520 ? 8 : 10
      return { n, gap, cw: (W - gap * (n - 1)) / n, visH: board!.clientHeight - 40 }
    }
    function colH(col: HeroBoardItem[]): number {
      return col.reduce((s, it) => s + it.h + M.gap, 0)
    }
    function hPlace(anim: boolean): void {
      cols.forEach((col, c) => {
        let y = 0
        col.forEach((it) => {
          it.x = c * (M.cw + M.gap)
          it.y = y
          it.el.style.transition = anim ? 'transform .9s var(--ex), opacity .5s' : 'none'
          it.el.style.transform = `translate(${it.x}px, ${it.y}px)`
          y += it.h + M.gap
        })
      })
    }
    function hLayout(): void {
      M = hMetrics()
      hItems.forEach((it) => {
        it.h = M.cw / it.s.a
        it.el.style.width = `${M.cw}px`
        it.el.style.height = `${it.h}px`
      })
      cols = Array.from({ length: M.n }, () => [])
      hItems.forEach((it) => {
        const heights = cols.map(colH)
        cols[heights.indexOf(Math.min(...heights))].push(it)
      })
      hPlace(false)
    }
    hLayout()

    function saveOne(): void {
      let cand: HeroBoardItem | null = null
      cols.forEach((col) => {
        col.forEach((it) => {
          if (it.y > M.visH && (!cand || it.y > cand.y)) cand = it
        })
      })
      if (!cand) {
        const heights = cols.map(colH)
        const lc = cols[heights.indexOf(Math.max(...heights))]
        cand = lc[lc.length - 1] ?? null
      }
      if (!cand) return
      const found: HeroBoardItem = cand
      cols.forEach((col) => {
        const i = col.indexOf(found)
        if (i >= 0) col.splice(i, 1)
      })
      const heights2 = cols.map(colH)
      const c = heights2.indexOf(Math.min(...heights2))
      cols[c].unshift(found)
      found.el.style.transition = 'none'
      found.el.style.opacity = '0'
      found.el.style.transform = `translate(${c * (M.cw + M.gap)}px, -10px)`
      found.el.getBoundingClientRect() // forced reflow — once per 5.4s cycle (R11), not per frame
      hPlace(true)
      found.el.style.opacity = '1'
      found.el.classList.remove('just')
      void found.el.offsetWidth // forced reflow to restart the "just saved" glow
      found.el.classList.add('just')
    }

    // ── paste → save loop + ambient steps: skipped entirely under reduced
    //    motion (R10: "no save loop, no ambient steps"), not just no-op'd. ──
    let heroOn = true
    // Browser timer ids are `number` (Window.setInterval/setTimeout). Not
    // `ReturnType<typeof window.setInterval>`: with @types/node loaded
    // globally, that alias resolves against the wrong overload (Node's
    // Timeout) even though a direct call still correctly returns `number`.
    let intervalId: number | undefined
    let pressTimeoutId: number | undefined
    let doneTimeoutId: number | undefined
    let rafId: number | undefined

    if (!reduce) {
      intervalId = window.setInterval(() => {
        if (!heroReadyRef.current || !heroOn || document.hidden) return
        paste.classList.add(styles.isPress)
        pressTimeoutId = window.setTimeout(() => {
          paste.classList.remove(styles.isPress)
          paste.classList.add(styles.isDone)
          saveOne()
        }, 240)
        doneTimeoutId = window.setTimeout(() => {
          paste.classList.remove(styles.isDone)
        }, 2200)
      }, 5400)

      const tick = (ts: number): void => {
        if (heroOn) steps.tick(ts)
        rafId = requestAnimationFrame(tick)
      }
      rafId = requestAnimationFrame(tick)
    }

    // IO runs regardless of reduced motion (mock 653): pauses the cards'
    // ambient CSS animations via the shared .is-off rule when off-screen.
    const io = new IntersectionObserver(
      (entries) => {
        heroOn = entries[0]?.isIntersecting ?? false
        section.classList.toggle('is-off', !heroOn)
      },
      { threshold: 0.05 },
    )
    io.observe(section)

    // ── resize (R11): debounced 160ms, hero's part of the mock's handler ──
    let resizeTimer: number | undefined
    const onResize = (): void => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(hLayout, 160)
    }
    window.addEventListener('resize', onResize)

    // ── intro (mock 811–833) ──
    let introTl: ReturnType<typeof gsap.timeline> | null = null
    const skipEvents = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const
    const skip = (): void => {
      if (introTl && introTl.isActive()) introTl.progress(1)
    }

    if (reduce) {
      // No intro: finished state immediately, no timeline, no listeners.
      root?.setAttribute('data-lp-intro', 'done')
      heroReadyRef.current = true
    } else {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const pr = panel.getBoundingClientRect() // init-time read — allowed

      const tl = gsap.timeline({
        paused: true,
        onStart: () => {
          heroReadyRef.current = false
        },
        onComplete: () => {
          heroReadyRef.current = true
          gsap.set(line, { autoAlpha: 0 })
          if (header) gsap.set(header, { clearProps: 'transform' })
        },
      })

      tl.set(line, { autoAlpha: 1, x: 0, y: 0, scaleX: 0 }, 0)
        .to(line, { scaleX: 1, duration: 0.55, ease: 'expo.inOut' }, 0)
        .to(
          line,
          {
            x: pr.left + pr.width / 2 - vw / 2,
            y: pr.top - vh / 2,
            scaleX: pr.width / vw,
            duration: 0.7,
            ease: 'expo.inOut',
          },
          0.5,
        )
      if (bggridLines.length > 0) {
        tl.fromTo(bggridLines, { scaleY: 0 }, { scaleY: 1, duration: 1, ease: 'expo.inOut', stagger: 0.03 }, 0.25)
      }
      tl.fromTo(
        panel,
        { clipPath: 'inset(0% 0% 100% 0% round 22px)' },
        { clipPath: 'inset(0% 0% 0% 0% round 22px)', duration: 0.9, ease: 'expo.out' },
        1.12,
      ).set(line, { autoAlpha: 0 }, 1.2)

      const cropEls = crop.querySelectorAll<HTMLElement>('i')
      if (cropEls.length > 0) {
        tl.fromTo(cropEls, { scale: 0 }, { scale: 1, duration: 0.6, ease: 'expo.out', stagger: 0.04 }, 1.35)
      }
      if (header) {
        tl.fromTo(header, { yPercent: -100 }, { yPercent: 0, duration: 0.7, ease: 'expo.out' }, 0.95)
      }
      const labelLn = section.querySelector<HTMLElement>('.label .ln')
      if (labelLn) {
        tl.fromTo(labelLn, { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: 'expo.out' }, 1.0)
      }
      const labelText = section.querySelector<HTMLElement>('.label [data-lp-text]')
      if (labelText) {
        tl.fromTo(labelText, { autoAlpha: 0, x: -6 }, { autoAlpha: 1, x: 0, duration: 0.6, ease: 'expo.out' }, 1.1)
      }
      const headlineSpans = section.querySelectorAll<HTMLElement>('.h1 .ml > span')
      if (headlineSpans.length > 0) {
        tl.fromTo(
          headlineSpans,
          { yPercent: 105 },
          { yPercent: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08 },
          1.05,
        )
      }
      tl.fromTo(
        [lead, ctas],
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: 0.8, ease: 'expo.out', stagger: 0.07 },
        1.2,
      )
        .fromTo(hruleBase, { scaleX: 0 }, { scaleX: 1, duration: 1.1, ease: 'expo.inOut' }, 1.3)
        .fromTo(scue, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, 1.5)

      introTl = tl
      root?.setAttribute('data-lp-intro', 'done')
      tl.play(0)

      skipEvents.forEach((ev) => {
        window.addEventListener(ev, skip, { passive: true })
      })
    }

    return () => {
      // cards + steps
      hItems.forEach((it) => it.el.remove())
      steps.clear()
      // save loop
      if (intervalId !== undefined) window.clearInterval(intervalId)
      window.clearTimeout(pressTimeoutId)
      window.clearTimeout(doneTimeoutId)
      // ambient tick loop
      if (rafId !== undefined) cancelAnimationFrame(rafId)
      // visibility
      io.disconnect()
      // resize
      window.clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      // intro
      introTl?.kill()
      skipEvents.forEach((ev) => {
        window.removeEventListener(ev, skip)
      })
      root?.removeAttribute('data-lp-intro')
    }
  }, [])

  const headlineLines = t('landing.hero.headline').split('\n')

  return (
    <section ref={sectionRef} id="hero" className={styles.hero}>
      <i ref={lineRef as React.RefObject<HTMLElement>} className={styles.iline} aria-hidden="true" />
      <div className={`wrap ${styles.heroGrid}`}>
        <div>
          <p className="label">
            <i className="ln" />
            <span data-lp-text>{LABEL_TEXT}</span>
          </p>
          <h1 className="h1">
            {headlineLines.map((line, i) => (
              <span className="ml" key={i}>
                <span data-lp-text>{line}</span>
              </span>
            ))}
          </h1>
          <p ref={leadRef} className={styles.lead} data-lp-text>
            {t('landing.hero.description')}
          </p>
          <div ref={ctasRef} className={styles.ctas}>
            <Link href="/board" className="btn roll">
              <span className="rl">
                <span data-lp-text>{t('landing.hero.ctaPrimary')}</span>
                <span aria-hidden="true">{t('landing.hero.ctaPrimary')}</span>
              </span>
              <span className="arr" aria-hidden="true">↗</span>
            </Link>
            <button
              type="button"
              className={`link ${styles.ghostReset}`}
              data-lp-text
              onClick={handleSeeHow}
            >
              {t('landing.hero.ctaGhost')}
            </button>
          </div>
        </div>

        <div className={styles.hvis}>
          <div ref={cropRef} className={styles.crop} aria-hidden="true">
            <i className={styles.tl} />
            <i className={styles.tr} />
            <i className={styles.bl} />
            <i className={styles.br} />
          </div>
          <div ref={panelRef} className={styles.panel} aria-hidden="true">
            <div className={styles.pchrome}>
              <span className={styles.wmS}>AllMarks</span>
              <span className={`${styles.motion} ${styles.on}`}>
                <i />
                Motion
              </span>
            </div>
            <div className={styles.slot}>
              <div ref={pasteRef} className={styles.paste} aria-hidden="true">
                <span className={styles.idle}>
                  <span className={styles.kbd}>{modKey}</span>
                  <span className={styles.kbd}>V</span>
                  <span className={styles.pl} data-lp-text>
                    {t('landing.demo.pasteHint')}
                  </span>
                </span>
                <span className={styles.done}>
                  <span className={styles.ok}>✓</span>
                  {t('landing.demo.saved')}
                </span>
              </div>
            </div>
            <div className={styles.boardArea}>
              <div ref={boardRef} className={styles.board} data-hero-board />
            </div>
            <i className={styles.pfade} />
          </div>
        </div>
      </div>

      <div className={`wrap ${styles.hrule}`} aria-hidden="true">
        <span ref={scueRef} className={styles.scue}>
          <i className={styles.drip} />
          <span className={styles.sroll}>
            {SCROLL_WORD.split('').map((ch, i) => (
              <b key={i}>
                <s style={{ animationDelay: `${(i * 0.05).toFixed(2)}s` }}>{ch}</s>
                <s style={{ animationDelay: `${(i * 0.05).toFixed(2)}s` }}>{ch}</s>
              </b>
            ))}
          </span>
        </span>
        <span className={styles.trk}>
          <i ref={hruleBaseRef as React.RefObject<HTMLElement>} className={styles.base} />
          <i className={styles.sweep} />
          {HERO_TICKS.map((tick, i) => (
            <i
              key={i}
              className={styles.tk}
              style={{ left: `${tick.left.toFixed(4)}%`, animationDelay: `${tick.delay.toFixed(3)}s` }}
            />
          ))}
        </span>
      </div>
    </section>
  )
}
