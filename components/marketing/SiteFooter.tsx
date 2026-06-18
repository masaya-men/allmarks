'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './SiteFooter.module.css'

// Register ScrollTrigger at import time — idempotent, safe to call multiple times.
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

/**
 * SiteFooter — dark footer that continues the FinalCta's near-black ground.
 *
 * Background: #0a0a0a (same as the FinalCta overlay end-state).
 * Text: off-white #f0efe9 / muted rgba variant.
 *
 * Footer Finale curtain (PC + prefers-reduced-motion: no-preference only):
 * A full-screen #0a0a0a panel with a large "Open Board →" button is pinned
 * at the top of the viewport as the user scrolls into the footer. After one
 * viewport-height of scroll the curtain fades to opacity:0, revealing the
 * standard nav below. On reduced-motion or non-PC the curtain is rendered
 * statically (no pin) and the Open Board button is immediately visible and
 * clickable.
 *
 * Nav labels sourced from useI18n() landing.footer.* keys — correctly shows
 * English when the LP runs without an I18nProvider (FALLBACK is English).
 * NO tilt. Minimal, refined editorial tone.
 */
export function SiteFooter(): React.ReactElement {
  const { t } = useI18n()

  /** Ref to the finale curtain element */
  const finaleRef = useRef<HTMLDivElement>(null)
  /** Ref to the footer root (ScrollTrigger trigger) */
  const footerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const footer = footerRef.current
    const finale = finaleRef.current
    if (!footer || !finale) return

    const mm = gsap.matchMedia()

    // PC (≥1024px) + normal motion: pin the curtain for one viewport-height
    // of scroll, then fade it out to reveal the nav below.
    mm.add(
      '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
      () => {
        // The curtain starts at opacity:1 (CSS default). After pin completes
        // we tween opacity to 0 so the nav below becomes visible.
        // scrub:true ties the fade to scroll position.
        const tl = gsap.timeline()
        tl.to(finale, { opacity: 0, ease: 'none' })

        const st = ScrollTrigger.create({
          trigger: footer,
          start: 'top top',
          end: '+=100vh',
          scrub: true,
          pin: finale,
          pinSpacing: false,
          animation: tl,
        })

        return () => { st.kill(); tl.kill() }
      },
    )

    return () => mm.revert()
  }, [])

  return (
    <footer ref={footerRef} className={styles.footer}>

      {/*
        Footer Finale curtain — full-screen #0a0a0a panel with large CTA.
        - PC + no-preference: pinned for 1 viewport-height then fades away.
        - Reduced-motion / non-PC: rendered statically; no pin, no animation.
          The Open Board button is always visible and clickable.
        aria-hidden is NOT set — the button must be accessible at all times.
      */}
      <div ref={finaleRef} className={styles.finale} data-footer-finale>
        <div className={styles.finaleInner}>
          <Link href="/board" className={styles.finaleButton}>
            Open Board
            <span className={styles.finaleArrow} aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      <div className={styles.inner}>

        {/* Brand column */}
        <div className={styles.brandColumn}>
          <Link href="/" className={styles.brand} aria-label="AllMarks home">
            AllMarks
          </Link>
          <p className={styles.tagline}>
            Save anything. See everything.
          </p>
          <p className={styles.privacy}>
            Data lives in your browser.
            <br />
            No accounts. No tracking.
          </p>
        </div>

        {/* Nav columns */}
        <div className={styles.columns}>

          <div className={styles.column}>
            <h3 className={styles.colHeading}>Product</h3>
            <ul className={styles.list}>
              <li>
                <Link href="/features" className={styles.link}>
                  {t('landing.footer.features')}
                </Link>
              </li>
              <li>
                <Link href="/guide" className={styles.link}>
                  {t('landing.footer.guide')}
                </Link>
              </li>
              <li>
                <Link href="/board" className={styles.link}>
                  Open Board
                </Link>
              </li>
            </ul>
          </div>

          <div className={styles.column}>
            <h3 className={styles.colHeading}>Company</h3>
            <ul className={styles.list}>
              <li>
                <Link href="/about" className={styles.link}>
                  {t('landing.footer.about')}
                </Link>
              </li>
              <li>
                <Link href="/faq" className={styles.link}>
                  {t('landing.footer.faq')}
                </Link>
              </li>
              <li>
                <Link href="/contact" className={styles.link}>
                  {t('landing.footer.contact')}
                </Link>
              </li>
            </ul>
          </div>

          <div className={styles.column}>
            <h3 className={styles.colHeading}>Legal</h3>
            <ul className={styles.list}>
              <li>
                <Link href="/privacy" className={styles.link}>
                  {t('landing.footer.privacy')}
                </Link>
              </li>
              <li>
                <Link href="/terms" className={styles.link}>
                  {t('landing.footer.terms')}
                </Link>
              </li>
            </ul>
          </div>

        </div>
      </div>

      {/* Bottom strip */}
      <div className={styles.bottom}>
        <p className={styles.copy}>&copy; 2026 AllMarks</p>
        <p className={styles.bottomRight}>
          Made with care. Designed for everyone.
        </p>
      </div>
    </footer>
  )
}
