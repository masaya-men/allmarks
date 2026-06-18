'use client'

import { useRef, useEffect, useCallback } from 'react'
import { gsap } from 'gsap'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { useHorizontalPin } from '@/lib/scroll/use-horizontal-pin'
import { panelProgress } from '@/lib/scroll/horizontal-pin-math'
import { DEMO_COLLAGE, DEMO_VIDEOS } from '@/lib/marketing/demo-collage'
import styles from './Features.module.css'

/**
 * One image card shown inside a beat visual. The artwork IS the card — clean,
 * label-free, axis-aligned, exactly matching the real board's ImageCard (which
 * renders only the image, no domain/host strip, no favicon). NEVER rotated.
 */
type VisualCard = {
  /** Index into DEMO_COLLAGE for the thumbnail. */
  readonly asset: number
  /** When true, draw a play-triangle overlay so the card reads as "video".
   *  This is an honest TYPE signal via shape, never a fabricated domain. */
  readonly video?: boolean
}

/**
 * A single feature "beat" in the 01–05 editorial sequence. The number + English
 * label kicker are HARDCODED here (intentionally not translated) — they are the
 * sequence's spine. The title/body are i18n keys under `landing.features.<key>`.
 */
type Beat = {
  /** Two-digit sequence number, e.g. "01". */
  readonly num: string
  /** English label kicker, e.g. "CAPTURE". Hardcoded, not translated. */
  readonly label: string
  /** i18n sub-key under landing.features (capture|layout|live|organize|privacy). */
  readonly key: string
  /** Which supporting visual to render in the visual slot. */
  readonly visual: 'capture' | 'layout' | 'live' | 'organize' | 'privacy'
}

/**
 * The five beats, in order. Numbers + labels are the hardcoded spine of the
 * sequence; titles/bodies come from i18n.
 */
const BEATS: readonly Beat[] = [
  { num: '01', label: 'CAPTURE', key: 'capture', visual: 'capture' },
  { num: '02', label: 'LAYOUT', key: 'layout', visual: 'layout' },
  { num: '03', label: 'LIVE GRID', key: 'live', visual: 'live' },
  { num: '04', label: 'ORGANIZE', key: 'organize', visual: 'organize' },
  { num: '05', label: 'PRIVACY', key: 'privacy', visual: 'privacy' },
] as const

/** 01 CAPTURE — a few clean cards of DIFFERENT shapes (wide / tall / square)
 *  plus ONE card flagged as video (play-triangle overlay, no domain text).
 *  "Variety of sources" is carried by shape + the copy, never fake labels. */
const CAPTURE_CARDS: readonly VisualCard[] = [
  { asset: 5 }, // Monet stacks — wide landscape
  { asset: 3, video: true }, // Van Gogh self-portrait — tall, marked as video
  { asset: 14 }, // Cézanne apples — near-square
] as const

/** 02 LAYOUT — a clean masonry like the real AllMarks board. Mixed formats so
 *  the columns balance; clean image cards only, no labels. */
const LAYOUT_CARDS: readonly VisualCard[] = [
  { asset: 0 }, // Hokusai wave (landscape)
  { asset: 6 }, // Renoir sisters (portrait)
  { asset: 9 }, // Caillebotte Paris street
  { asset: 8 }, // Moulin Rouge
  { asset: 12 }, // Tiffany lilies (tall thin)
  { asset: 1 }, // Hiroshige Tokaido (landscape)
] as const

/** 04 ORGANIZE — theme-agnostic swatches. Neutral inks + one green accent so
 *  no single theme is branded. Paired with a few text tag pills. */
const THEME_SWATCHES: readonly string[] = [
  '#14130f',
  '#faf9f6',
  '#28f100',
  '#9a958a',
  '#3b3a35',
] as const

/** 04 ORGANIZE — example tag chips. Plain, lowercase, neutral text. */
const TAG_PILLS: readonly string[] = ['inspo', 'video', 'shop', 'read'] as const

/** 05 PRIVACY — short typographic reassurance rows. */
const PRIVACY_ROWS: readonly string[] = [
  'No account',
  'Stored locally',
  'Always free',
] as const

/**
 * 03 LIVE GRID — the AllMarks differentiator: multiple real videos playing at
 * once. Three NASA public-domain clips in a 2+1 grid layout; all autoplay
 * only while in the viewport (IntersectionObserver) and respect reduced-motion.
 *
 * Grid: large aurora (top-left, 2×1 cell wide) + earth + nebula stacked in the
 * right column. Covers the cells with object-fit:cover so the low-res 320px
 * clips look clean and never letterboxed.
 */
function LiveGrid(): React.ReactElement {
  const slotRef = useRef<HTMLDivElement>(null)
  // Stable refs to the three video elements — avoids stale closure issues
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([null, null, null])

  useEffect(() => {
    const slot = slotRef.current
    if (!slot) return

    // Reduced-motion: check once. If user prefers-reduced-motion, never autoplay.
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reducedMotion) return

    const videos = videoRefs.current.filter((v): v is HTMLVideoElement => v !== null)

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            for (const v of videos) {
              // play() returns a Promise; ignore the rejection if interrupted
              v.play().catch(() => {})
            }
          } else {
            for (const v of videos) {
              v.pause()
            }
          }
        }
      },
      { threshold: 0.25 },
    )

    observer.observe(slot)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={slotRef}
      className={styles.liveGrid}
      data-livegrid-slot
      aria-hidden="true"
    >
      {DEMO_VIDEOS.map((vid, i) => (
        <figure
          key={vid.src}
          className={`${styles.liveCell} ${styles[`liveCell${i}`]}`}
        >
          <video
            ref={(el) => {
              videoRefs.current[i] = el
            }}
            src={`/${vid.src}`}
            poster={`/${vid.poster}`}
            muted
            loop
            playsInline
            preload="none"
            className={styles.liveCellVideo}
          />
        </figure>
      ))}
      {/* Sound-wave pulse bars for the LIVE panel micro-anim.
          Three vertical bars that pulse via scaleY driven by onProgress. */}
      <div className={styles.livePulse} aria-hidden="true">
        <span className={styles.liveBar} data-live-bar="0" />
        <span className={styles.liveBar} data-live-bar="1" />
        <span className={styles.liveBar} data-live-bar="2" />
        <span className={styles.liveBar} data-live-bar="3" />
        <span className={styles.liveBar} data-live-bar="4" />
      </div>
    </div>
  )
}

/**
 * Renders the supporting visual for a given beat. All cards are clean image
 * thumbnails (no labels, no fabricated domains) and strictly axis-aligned.
 */
function BeatVisual({ visual }: { visual: Beat['visual'] }): React.ReactElement {
  if (visual === 'capture') {
    return (
      <div className={styles.captureRow} data-panel-visual="capture">
        {CAPTURE_CARDS.map((card, i) => {
          const art = DEMO_COLLAGE[card.asset]
          if (!art) return null
          return (
            <figure key={i} className={styles.card} data-capture-card={i}>
              <img
                src={`/${art.src}`}
                alt=""
                width={art.w}
                height={art.h}
                className={styles.cardImg}
                loading="lazy"
                decoding="async"
                draggable={false}
              />
              {card.video ? (
                <span className={styles.playBadge} aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path d="M8 5v14l11-7z" fill="currentColor" />
                  </svg>
                </span>
              ) : null}
            </figure>
          )
        })}
      </div>
    )
  }

  if (visual === 'layout') {
    return (
      <div className={styles.masonry} data-panel-visual="layout">
        {LAYOUT_CARDS.map((card, i) => {
          const art = DEMO_COLLAGE[card.asset]
          if (!art) return null
          return (
            <figure key={i} className={styles.card} data-layout-card={i}>
              <img
                src={`/${art.src}`}
                alt=""
                width={art.w}
                height={art.h}
                className={styles.cardImg}
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            </figure>
          )
        })}
      </div>
    )
  }

  if (visual === 'live') {
    return <LiveGrid />
  }

  if (visual === 'organize') {
    return (
      <div className={styles.organize} data-panel-visual="organize">
        <div className={styles.pillRow} aria-hidden="true">
          {TAG_PILLS.map((tag, i) => (
            <span key={tag} className={styles.pill} data-organize-pill={i}>
              <span className={styles.pillHash}>#</span>
              {tag}
            </span>
          ))}
        </div>
        <div className={styles.swatchRow} aria-hidden="true">
          {THEME_SWATCHES.map((c, i) => (
            <span
              key={i}
              className={styles.swatch}
              style={{ background: c }}
              data-organize-swatch={i}
            />
          ))}
        </div>
      </div>
    )
  }

  // privacy — quiet typographic rows, minimal visual
  return (
    <ul className={styles.privacyList} aria-hidden="true" data-panel-visual="privacy">
      {PRIVACY_ROWS.map((row, i) => (
        <li key={row} className={styles.privacyRow} data-privacy-row={i}>
          <span className={styles.privacyDot} />
          {row}
        </li>
      ))}
    </ul>
  )
}

/**
 * Features — the FEATURES section of the LP, as a numbered editorial sequence
 * (01–05), NOT a boxed SaaS grid.
 *
 * On PC widths (≥1024px) with no reduced-motion preference the five beats are
 * laid out horizontally and the section is pinned while the track scrolls
 * laterally (scroll-jack via useHorizontalPin). On narrow widths and under
 * prefers-reduced-motion the beats stack vertically in the classic alternating
 * text-left / visual-right two-column layout (CSS fallback).
 *
 * Hard rules honored: every card/image is AXIS-ALIGNED (never tilted), and NO
 * fabricated source domains/favicons appear anywhere — source variety is shown
 * through card shape/type (e.g. a play-triangle = video) and through the copy.
 *
 * The 03 LIVE GRID visual renders real autoplaying NASA public-domain video
 * loops via the `LiveGrid` component — in-view-only (IntersectionObserver)
 * with poster fallbacks under prefers-reduced-motion.
 */
export function Features(): React.ReactElement {
  const { t } = useI18n()
  const sectionRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const progressFillRef = useRef<HTMLSpanElement>(null)

  /**
   * Drive all per-panel micro-animations from the single 0..1 global progress.
   * Only called in the PC + no-preference branch (matchMedia inside the hook).
   * Uses gsap.set / quickSetter for zero-overhead per-frame updates.
   * Default visual state is always "visible" — animations only add polish.
   */
  const handleProgress = useCallback((p: number): void => {
    const section = sectionRef.current
    if (!section) return

    // ── Sound-wave progress bar ──────────────────────────────────────────────
    const fill = progressFillRef.current
    if (fill) {
      gsap.set(fill, { scaleX: p })
    }

    // Helper: ease a 0..1 value through expo-out-ish curve
    const easeOut = (v: number): number => 1 - Math.pow(1 - v, 3)

    // ── Panel 0 (CAPTURE): 3 cards scale+opacity + slight x convergence ──────
    const lp0 = panelProgress(p, 5, 0)
    const e0 = easeOut(Math.min(1, lp0 / 0.55))
    const captureCards = section.querySelectorAll<HTMLElement>('[data-capture-card]')
    captureCards.forEach((el, i) => {
      // Center card (i=1) converges from right; outer cards from their sides
      const xFrom = i === 0 ? -14 : i === 2 ? 14 : 0
      gsap.set(el, {
        scale: 0.8 + 0.2 * e0,
        opacity: e0,
        x: xFrom * (1 - e0),
      })
    })

    // ── Panel 1 (LAYOUT): masonry cards stagger in from y:24 ─────────────────
    const lp1 = panelProgress(p, 5, 1)
    const layoutCards = section.querySelectorAll<HTMLElement>('[data-layout-card]')
    layoutCards.forEach((el, i) => {
      // Each card gets its own offset so they feel like a stagger
      const staggerOffset = i * 0.12
      const raw = Math.max(0, Math.min(1, (lp1 - staggerOffset) / (0.55 - staggerOffset * 0.5)))
      const e1 = easeOut(raw)
      gsap.set(el, {
        y: 24 * (1 - e1),
        opacity: e1,
      })
    })

    // ── Panel 2 (LIVE): pulse bars scaleY driven by progress ─────────────────
    const lp2 = panelProgress(p, 5, 2)
    const liveBars = section.querySelectorAll<HTMLElement>('[data-live-bar]')
    liveBars.forEach((el, i) => {
      // Each bar oscillates at a different phase / amplitude
      const phase = i * 0.18
      const wave = 0.35 + 0.65 * Math.abs(Math.sin((lp2 * 2.4 + phase) * Math.PI))
      const e2 = easeOut(Math.min(1, lp2 / 0.4))
      gsap.set(el, { scaleY: wave * e2 })
    })

    // ── Panel 3 (ORGANIZE): pills x+opacity, then swatches ───────────────────
    const lp3 = panelProgress(p, 5, 3)
    const pills = section.querySelectorAll<HTMLElement>('[data-organize-pill]')
    pills.forEach((el, i) => {
      const offset = i * 0.09
      const raw = Math.max(0, Math.min(1, (lp3 - offset) / (0.45 - offset * 0.3)))
      const e3p = easeOut(raw)
      gsap.set(el, { x: -16 * (1 - e3p), opacity: e3p })
    })
    const swatches = section.querySelectorAll<HTMLElement>('[data-organize-swatch]')
    swatches.forEach((el, i) => {
      // Swatches lag behind pills
      const offset = 0.22 + i * 0.06
      const raw = Math.max(0, Math.min(1, (lp3 - offset) / 0.35))
      const e3s = easeOut(raw)
      gsap.set(el, { x: -16 * (1 - e3s), opacity: e3s })
    })

    // ── Panel 4 (PRIVACY): rows fade in + slight x slide ─────────────────────
    const lp4 = panelProgress(p, 5, 4)
    const rows = section.querySelectorAll<HTMLElement>('[data-privacy-row]')
    rows.forEach((el, i) => {
      const offset = i * 0.13
      const raw = Math.max(0, Math.min(1, (lp4 - offset) / (0.5 - offset * 0.2)))
      const e4 = easeOut(raw)
      gsap.set(el, { x: -12 * (1 - e4), opacity: e4 })
    })
  }, [])

  /**
   * In the PC + no-preference branch, set the "before animation" initial state
   * for all animated elements so they start invisible (opacity:0 etc.) and
   * onProgress builds them in. In the static fallback (reduced-motion / non-PC)
   * this block never runs and all elements stay fully visible (their CSS default).
   */
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const mm = gsap.matchMedia()
    mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
      gsap.set(section.querySelectorAll('[data-capture-card]'), { opacity: 0, scale: 0.8 })
      gsap.set(section.querySelectorAll('[data-layout-card]'), { opacity: 0, y: 24 })
      gsap.set(section.querySelectorAll('[data-organize-pill]'), { opacity: 0, x: -16 })
      gsap.set(section.querySelectorAll('[data-organize-swatch]'), { opacity: 0, x: -16 })
      gsap.set(section.querySelectorAll('[data-privacy-row]'), { opacity: 0, x: -12 })
      gsap.set(section.querySelectorAll('[data-live-bar]'), { scaleY: 0 })
      return () => {
        // Restore visible state on unmount / breakpoint revert
        gsap.set(section.querySelectorAll('[data-capture-card]'), { clearProps: 'opacity,scale,x' })
        gsap.set(section.querySelectorAll('[data-layout-card]'), { clearProps: 'opacity,y' })
        gsap.set(section.querySelectorAll('[data-organize-pill]'), { clearProps: 'opacity,x' })
        gsap.set(section.querySelectorAll('[data-organize-swatch]'), { clearProps: 'opacity,x' })
        gsap.set(section.querySelectorAll('[data-privacy-row]'), { clearProps: 'opacity,x' })
        gsap.set(section.querySelectorAll('[data-live-bar]'), { clearProps: 'scaleY' })
      }
    })
    return () => mm.revert()
  }, [])

  useHorizontalPin({
    sectionRef: sectionRef as React.RefObject<HTMLElement>,
    trackRef: trackRef as React.RefObject<HTMLElement>,
    onProgress: handleProgress,
  })

  return (
    <section ref={sectionRef} id="features" className={styles.features}>
      <div className={styles.stage}>
        <p className={styles.kicker}>
          <span className={styles.kickerDash} aria-hidden="true" />
          FEATURES
        </p>

        {/* Sound-wave progress bar — PC + no-preference only (CSS hides on mobile/reduced) */}
        <div className={styles.progress} aria-hidden="true">
          <span ref={progressFillRef} className={styles.progressFill} />
        </div>

        <div ref={trackRef} className={styles.track}>
          {BEATS.map((beat) => (
            <article key={beat.num} className={styles.beat} data-panel>
              <div className={styles.beatText}>
                <p className={styles.beatNum}>
                  <span className={styles.num}>{beat.num}</span>
                  <span className={styles.numLabel}>{beat.label}</span>
                </p>
                <h3 className={styles.beatTitle}>
                  {t(`landing.features.${beat.key}.title`)}
                </h3>
                <p className={styles.beatBody}>
                  {t(`landing.features.${beat.key}.body`)}
                </p>
              </div>

              <div className={styles.beatVisual}>
                <BeatVisual visual={beat.visual} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
