'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { useReveal } from '@/lib/scroll/use-reveal'
import styles from './FinalCta.module.css'

// Register ScrollTrigger at import time — idempotent, safe to call multiple times.
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

/**
 * FinalCta — the climax section of the AllMarks LP.
 *
 * Transitions the white LP ground (#faf9f6) into the near-black of the app
 * (#0a0a0a) via a GSAP ScrollTrigger scrub on an absolute overlay layer.
 * By the time the CTA content is centered in the viewport the ground is fully
 * black, making the transition into the board feel seamless.
 *
 * Reduced-motion: skip the scrub — start already on the black end-state via
 * gsap.matchMedia(), so reduced-motion users never see a broken half-state.
 *
 * Hard rules honoured:
 * - No rotation/tilt anywhere (AllMarks hard rule)
 * - Vanilla CSS Modules only (no Tailwind)
 * - px/clamp only (no rem)
 * - GSAP + ScrollTrigger only (no Framer Motion)
 * - Static-export-safe
 */
export function FinalCta(): React.ReactElement {
  const { t } = useI18n()

  /** Root section ref — also the ScrollTrigger trigger element. */
  const sectionRef = useRef<HTMLElement>(null)

  /** The full-bleed black overlay whose opacity is scrubbed 0 → 1. */
  const overlayRef = useRef<HTMLDivElement>(null)

  // Reveal headline + button via the shared useReveal hook.
  // data-reveal items start opacity:0 and are revealed via useReveal.
  // On reduced-motion useReveal immediately sets opacity:1 so everything
  // stays visible regardless of the overlay state.
  useReveal(sectionRef as React.RefObject<HTMLElement>, { y: 24, stagger: 0.12 })

  useEffect(() => {
    const section = sectionRef.current
    const overlay = overlayRef.current
    if (!section || !overlay) return

    const mm = gsap.matchMedia()

    // Reduced-motion: lock the overlay at full opacity (black) immediately.
    // Combined with useReveal's reduced-motion branch (opacity:1 on data-reveal),
    // the section renders as a solid black panel with legible light text.
    mm.add('(prefers-reduced-motion: reduce)', () => {
      gsap.set(overlay, { opacity: 1 })
    })

    // Normal motion: scrub the overlay opacity from 0 to 1 as the user
    // scrolls from the TOP of the section to the centre of the viewport.
    // The background-color tween is on a separate non-layout layer (opacity
    // only) so no layout is triggered.
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const st = ScrollTrigger.create({
        trigger: section,
        start: 'top bottom',   // overlay starts fading in as section enters viewport
        end: 'center center',  // fully black once centre of section hits centre of viewport
        onUpdate: (self) => {
          gsap.set(overlay, { opacity: self.progress })
        },
      })
      return () => st.kill()
    })

    return () => mm.revert()
  }, [])

  return (
    <section ref={sectionRef} id="cta" className={styles.cta}>
      {/*
        Black overlay — scrolled in via GSAP scrub. Sits below the content
        via z-index so it never captures pointer events or blocks the CTA.
        On reduced-motion this is immediately opacity:1 (pure black ground).
      */}
      <div ref={overlayRef} className={styles.overlay} aria-hidden="true" />

      {/* CTA content — centred, light ink on black, revealed by useReveal. */}
      <div className={styles.stage}>
        <div className={styles.inner}>

          {/* Small accent line above the headline — green --lp-accent rule */}
          <span className={styles.rule} aria-hidden="true" />

          <h2 className={styles.headline} data-reveal>
            {t('landing.cta.headline')}
          </h2>

          <Link href="/board" className={styles.button} data-reveal>
            {t('landing.cta.button')}
            <span className={styles.arrow} aria-hidden="true">→</span>
          </Link>

        </div>
      </div>
    </section>
  )
}
