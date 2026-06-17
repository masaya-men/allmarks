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
 * One tile in the bold artwork grid. Tiles are AXIS-ALIGNED (never rotated) and
 * flow inside a CSS columns masonry — orderly, grid-like, echoing the product's
 * clean board layout. No scatter, no tilt: that is an AllMarks rule.
 */
type GridTile = {
  /** Index into DEMO_COLLAGE for the artwork shown in this tile. */
  readonly asset: number
  /** Float keyframe delay in seconds (de-syncs the gentle vertical drift). */
  readonly delay: number
}

/**
 * Curated 8-artwork masonry. Hand-picked assets mixing landscape, portrait and
 * tall formats so the column flow stays visually balanced. The grid is the bold
 * hero now — large, confident, image-first — partially occluding the big word.
 */
const GRID_TILES: readonly GridTile[] = [
  { asset: 3, delay: 0 }, // Van Gogh self-portrait (portrait)
  { asset: 0, delay: 0.5 }, // Hokusai wave (landscape)
  { asset: 8, delay: 1.1 }, // Moulin Rouge
  { asset: 6, delay: 0.3 }, // Renoir sisters (portrait)
  { asset: 5, delay: 1.4 }, // Monet stacks (wide)
  { asset: 14, delay: 0.8 }, // Cézanne apples
  { asset: 12, delay: 1.7 }, // Tiffany lilies (tall thin)
  { asset: 9, delay: 0.6 }, // Caillebotte Paris street
] as const

/**
 * Hero — signature landing section.
 *
 * Image-first and grid-based: a bold masonry of large, perfectly upright
 * artworks dominates the composition (echoing the product's clean board), while
 * an oversized faint serif keyword ("collage") drifts one layer back on scroll
 * and is partially occluded by the grid — real layered depth on a white ground.
 * The headline column keeps generous breathing room so it stays fully legible.
 */
export function Hero(): React.ReactElement {
  const { t } = useI18n()
  const sectionRef = useRef<HTMLElement>(null)
  const bgWordRef = useRef<HTMLDivElement>(null)

  // The scroll hooks declare a non-null RefObject<HTMLElement>; the refs are
  // genuinely non-null once mounted and the hooks null-check `.current` inside.
  useParallaxLayer(bgWordRef as RefObject<HTMLElement>, 120)
  useReveal(sectionRef as RefObject<HTMLElement>, { y: 32, stagger: 0.1 })

  const handleSeeHow = (): void => {
    const target =
      document.getElementById('features') ?? document.getElementById('save-demo')
    target?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section ref={sectionRef} id="hero" className={styles.hero}>
      <div className={styles.stage}>
        {/* Background layer — oversized faint serif keyword, drifts on scroll.
            Shell handles absolute centering; inner bgWord is the parallax target.
            GSAP writes `y` on bgWordRef (the inner element) only, so the shell's
            translate(-50%,-50%) centering is never clobbered. */}
        <div className={styles.bgWordShell} aria-hidden="true">
          <div ref={bgWordRef} className={styles.bgWord}>
            collage
          </div>
        </div>

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

          {/* Bold grid layer — large, upright artworks in a clean masonry that
              partially occludes the big background word. No rotation, no tilt. */}
          <div className={styles.grid} aria-hidden="true" data-reveal>
            {GRID_TILES.map((tile, i) => {
              const art = DEMO_COLLAGE[tile.asset]
              return (
                <figure
                  key={i}
                  className={styles.tile}
                  style={
                    {
                      '--float-delay': `${tile.delay}s`,
                    } as React.CSSProperties
                  }
                >
                  <img
                    src={`/${art.src}`}
                    alt=""
                    width={art.w}
                    height={art.h}
                    className={styles.tileImg}
                    loading={i < 3 ? 'eager' : 'lazy'}
                    decoding="async"
                    draggable={false}
                  />
                </figure>
              )
            })}
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
