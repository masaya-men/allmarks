'use client'

import { useRef, useEffect, type RefObject } from 'react'
import Link from 'next/link'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { useParallaxLayer } from '@/lib/scroll/use-parallax-layer'
import { useReveal } from '@/lib/scroll/use-reveal'
import { DEMO_COLLAGE } from '@/lib/marketing/demo-collage'
import styles from './Hero.module.css'

// Register ScrollTrigger at import time. The scroll hooks below call
// ScrollTrigger.create() inside child effects, which fire BEFORE the parent
// LandingPage's registration effect — so register here to guarantee it exists.
// registerPlugin is idempotent, so the double-register with LandingPage is safe.
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

/**
 * One saved image card on the hero board-mock. The artwork is the card
 * thumbnail — clean, label-free, exactly matching the real board's ImageCard
 * which renders only the image with no domain/host strip.
 * Cards are AXIS-ALIGNED — never rotated. That is a hard AllMarks rule.
 */
type BoardCard = {
  /** Index into DEMO_COLLAGE for the thumbnail shown on this card. */
  readonly asset: number
}

/**
 * Curated saved-cards for the board-mock. Hand-picked assets mixing landscape,
 * portrait and tall formats so the masonry columns stay balanced.
 * Matches the real board's ImageCard convention: clean image, no labels.
 */
const BOARD_CARDS: readonly BoardCard[] = [
  { asset: 0 }, // Hokusai wave (landscape)
  { asset: 3 }, // Van Gogh self-portrait (portrait)
  { asset: 8 }, // Moulin Rouge
  { asset: 5 }, // Monet stacks (wide)
  { asset: 6 }, // Renoir sisters (portrait)
  { asset: 14 }, // Cézanne apples
  { asset: 9 }, // Caillebotte Paris street
  { asset: 12 }, // Tiffany lilies (tall thin)
] as const

/**
 * Hero — signature landing section.
 *
 * Product-forward: the hero visual is a large, clean AllMarks BOARD mock — a
 * masonry of upright cards showing clean artwork thumbnails only (no labels,
 * no favicon dots), matching the real board's ImageCard convention. It reads as
 * "your saved links become this visual board", letting the PRODUCT do the
 * talking. The headline column keeps generous whitespace so it stays legible,
 * and the whole composition reflows to a clean single-column stack on narrow
 * viewports. NO rotation anywhere — AllMarks is grid-based.
 */
export function Hero(): React.ReactElement {
  const { t } = useI18n()
  const sectionRef = useRef<HTMLElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)

  // The scroll hooks declare a non-null RefObject<HTMLElement>; the refs are
  // genuinely non-null once mounted and the hooks null-check `.current` inside.
  // Gentle drift on the board block is depth, secondary to clarity, and is
  // disabled under prefers-reduced-motion by the hook's matchMedia.
  useParallaxLayer(boardRef as RefObject<HTMLElement>, 56)
  useReveal(sectionRef as RefObject<HTMLElement>, { y: 28, stagger: 0.09 })

  // ── Entrance timeline (mount-once, PC + no-preference only) ──
  // CSS defaults are always "visible" (opacity:1, no transform). The gsap.set()
  // initial state (opacity:0, yPercent:110, scale:0.96) is applied ONLY inside
  // the matchMedia branch, so SSR/reduced-motion/narrow viewports never hide
  // the headline or cards.
  //
  // Conflict avoidance with useReveal:
  //   useReveal animates [data-reveal] on scroll (opacity 0→1 + y).
  //   The headline carries data-reveal so useReveal would also animate it.
  //   On PC+no-preference the entrance timeline owns the headline's opacity and
  //   yPercent; to avoid the double-animation we mark the headline rows with
  //   data-entrance-done after the timeline completes — useReveal's ScrollTrigger
  //   will still "fire" but the element is already fully visible (opacity:1, y:0)
  //   so the second animation is a no-op visually.
  //
  // Parallax safety:
  //   useParallaxLayer writes `y` on boardRef (the inner .board div).
  //   Entrance timeline animates `scale` + `opacity` on [data-hero-card] children
  //   inside that div — different elements, different properties — no conflict.
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const mm = gsap.matchMedia()

    mm.add(
      '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
      () => {
        const lines = section.querySelectorAll<HTMLElement>('[data-hero-line]')
        const cards = section.querySelectorAll<HTMLElement>('[data-hero-card]')

        if (lines.length === 0 && cards.length === 0) return

        // Apply initial hidden state only in this branch.
        if (lines.length > 0) gsap.set(lines, { yPercent: 110 })
        if (cards.length > 0) gsap.set(cards, { scale: 0.96, opacity: 0 })

        const tl = gsap.timeline({ defaults: { ease: 'power4.out' } })

        if (lines.length > 0) {
          tl.to(lines, {
            yPercent: 0,
            duration: 0.9,
            stagger: 0.12,
            ease: 'power4.out',
            onComplete: () => {
              gsap.set(lines, { clearProps: 'yPercent' })
            },
          })
        }

        if (cards.length > 0) {
          tl.to(
            cards,
            {
              scale: 1,
              opacity: 1,
              duration: 0.8,
              stagger: 0.07,
              ease: 'power3.out',
              onComplete: () => {
                gsap.set(cards, { clearProps: 'scale,opacity' })
              },
            },
            lines.length > 0 ? '-=0.55' : 0,
          )
        }

        return () => {
          tl.kill()
          if (lines.length > 0) gsap.set(lines, { clearProps: 'all' })
          if (cards.length > 0) gsap.set(cards, { clearProps: 'all' })
        }
      },
    )

    return () => mm.revert()
  }, [])

  const handleSeeHow = (): void => {
    const target =
      document.getElementById('features') ?? document.getElementById('save-demo')
    target?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section ref={sectionRef} id="hero" className={styles.hero}>
      <div className={styles.stage}>
        <div className={styles.split}>
          {/* Content column — kicker, headline, description, CTAs. */}
          <div className={styles.content}>
            <p className={styles.label} data-reveal>
              <span className={styles.dot} aria-hidden="true" />
              {t('landing.hero.label')}
            </p>

            <h1 className={styles.headline} data-reveal>
              {/* Visual line wrappers for the entrance mask-up animation.
                  Each span[data-hero-line] slides up from yPercent:110 inside
                  an overflow:hidden parent (.headlineLine). The text content and
                  i18n key are unchanged — only a visual wrapping span is added. */}
              <span className={styles.headlineLine}>
                <span data-hero-line>{t('landing.hero.headline')}</span>
              </span>
            </h1>

            <p className={styles.description} data-reveal>
              {t('landing.hero.description')}
            </p>

            <div className={styles.ctaRow} data-reveal>
              <Link href="/board" className={styles.ctaPrimary}>
                {t('landing.hero.ctaPrimary')}
                <span className={styles.ctaArrow} aria-hidden="true">
                  →
                </span>
              </Link>
              <button
                type="button"
                className={styles.ctaGhost}
                onClick={handleSeeHow}
              >
                {t('landing.hero.ctaGhost')}
              </button>
            </div>
          </div>

          {/* Product-forward visual: a large, clean AllMarks BOARD mock.
              Clean image cards — no source labels, no favicon dots — matching
              the real board's ImageCard convention. No rotation, no tilt. */}
          <div className={styles.boardWrap} data-reveal>
            <div ref={boardRef} className={styles.board} aria-hidden="true">
              {BOARD_CARDS.map((card, i) => {
                const art = DEMO_COLLAGE[card.asset]
                if (!art) return null
                return (
                  <div key={i} className={styles.card} data-hero-card>
                    <div className={styles.thumb}>
                      <img
                        src={`/${art.src}`}
                        alt=""
                        width={art.w}
                        height={art.h}
                        className={styles.thumbImg}
                        loading={i < 4 ? 'eager' : 'lazy'}
                        decoding="async"
                        draggable={false}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.scrollHint} aria-hidden="true">
        <span className={styles.scrollLine} />
        <span className={styles.scrollWord}>{t('landing.hero.scrollHint')}</span>
      </div>
    </section>
  )
}
