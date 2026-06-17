'use client'

import { useRef, type RefObject } from 'react'
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
 * masonry of upright cards (artwork thumbnail + favicon-dot + source label) on
 * an off-white ground, echoing the real board's ~20px card radius. It reads as
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
              {t('landing.hero.headline')}
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
                return (
                  <div key={i} className={styles.card}>
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
