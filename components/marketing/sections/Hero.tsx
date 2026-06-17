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
 * Placement spec for one floating foreground collage card.
 * Coordinates are percentages of the stage; the card partially occludes the
 * oversized background serif keyword to create real layered depth.
 */
type CardSlot = {
  /** Index into DEMO_COLLAGE for the artwork shown in this card. */
  readonly asset: number
  /** Horizontal position (CSS left, % of stage). */
  readonly left: string
  /** Vertical position (CSS top, % of stage). */
  readonly top: string
  /** Rendered card width in px (height derives from the asset aspect ratio). */
  readonly width: number
  /** Static rotation in degrees for the editorial "pinned" feel. */
  readonly rot: number
  /** Float keyframe delay in seconds (de-syncs the drift). */
  readonly delay: number
  /** Stacking order — higher sits above the big type and other cards. */
  readonly z: number
}

/**
 * Curated 6-card arrangement. Hand-picked assets + positions so the cards
 * frame the headline column and clip the background word at its edges.
 */
const CARD_SLOTS: readonly CardSlot[] = [
  { asset: 0, left: '4%', top: '14%', width: 244, rot: -4, delay: 0, z: 3 }, // Hokusai wave (landscape)
  { asset: 3, left: '70%', top: '6%', width: 176, rot: 3.5, delay: 1.1, z: 4 }, // Van Gogh self-portrait (portrait)
  { asset: 8, left: '80%', top: '52%', width: 230, rot: -3, delay: 0.6, z: 3 }, // Moulin Rouge
  { asset: 6, left: '10%', top: '58%', width: 168, rot: 4.5, delay: 1.7, z: 4 }, // Renoir sisters (portrait)
  { asset: 5, left: '60%', top: '70%', width: 210, rot: -2, delay: 2.2, z: 2 }, // Monet stacks (wide)
  { asset: 12, left: '30%', top: '2%', width: 96, rot: 5, delay: 1.4, z: 2 }, // Tiffany lilies (tall thin)
] as const

/**
 * Hero — signature landing section.
 *
 * Establishes the LP's visual language (serif display scale, generous white
 * space, restrained motion). The depth effect is the soul: an oversized faint
 * serif keyword ("collage") drifts on scroll one layer back, while six floating
 * collage cards sit in front and partially occlude it, producing genuine
 * parallax depth on a white ground.
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

        {/* Foreground layer — floating collage cards that occlude the big word. */}
        <div className={styles.cardsLayer} aria-hidden="true">
          {CARD_SLOTS.map((slot, i) => {
            const art = DEMO_COLLAGE[slot.asset]
            const height = Math.round((slot.width * art.h) / art.w)
            return (
              <figure
                key={i}
                className={styles.card}
                style={
                  {
                    left: slot.left,
                    top: slot.top,
                    width: `${slot.width}px`,
                    zIndex: slot.z,
                    '--rot': `${slot.rot}deg`,
                    '--float-delay': `${slot.delay}s`,
                  } as React.CSSProperties
                }
              >
                <img
                  src={`/${art.src}`}
                  alt=""
                  width={slot.width}
                  height={height}
                  className={styles.cardImg}
                  loading={i < 2 ? 'eager' : 'lazy'}
                  decoding="async"
                  draggable={false}
                />
              </figure>
            )
          })}
        </div>

        {/* Content layer — kicker, headline, description, CTAs. */}
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
            <button type="button" className={styles.ctaGhost} onClick={handleSeeHow}>
              {t('landing.hero.ctaGhost')}
            </button>
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
