'use client'

import { useEffect } from 'react'
import { useSmoothScroll } from '@/lib/scroll/use-smooth-scroll'
import { useScrollTrigger } from '@/lib/scroll/use-scroll-trigger'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { Hero } from './sections/Hero'
import { Problem } from './sections/Problem'
import { Features } from './sections/Features'
import { ShareIt } from './sections/ShareIt'
import { FinalCta } from './sections/FinalCta'
import './landing-tokens.css'
import styles from './LandingPage.module.css'

/**
 * LandingPage — root client component for the AllMarks marketing LP.
 *
 * Initialises Lenis smooth scrolling and GSAP ScrollTrigger, then renders
 * the full editorial flow:
 *
 *   SiteHeader (fixed, transparent → scrolled)
 *   ─── white editorial ground (#faf9f6) ──────────────────────────────
 *   Hero        — product board-mock visual + headline + CTAs
 *   Problem     — the problem we solve
 *   Features    — 01-05 feature cards with live video grid
 *   ShareIt     — share / export story
 *   ─── white fades to black (FinalCta GSAP scrub) ──────────────────
 *   FinalCta    — climax CTA on near-black ground
 *   ─── black continues seamlessly ──────────────────────────────────
 *   SiteFooter  — dark editorial footer (#0a0a0a)
 */
export function LandingPage(): React.ReactElement {
  useSmoothScroll()
  useScrollTrigger()

  // The marketing LP is an intentionally LIGHT world, but the app's root
  // <html> defaults to data-theme="dark" (the board is dark). Without an
  // explicit light declaration, browser auto-dark-mode (Chrome's "Auto Dark
  // Mode for Web Contents" flag, or dark-mode extensions) force-darkens this
  // white page. Mark the document as light while the LP is mounted; restore
  // dark on unmount so navigating into the (dark) board is unaffected. The
  // old marketing ThemeToggle used to do this implicitly; it was removed in
  // the redesign, so the LP now owns the declaration. (color-scheme: light
  // on .lpRoot in landing-tokens.css reinforces this for auto-dark.)
  useEffect(() => {
    const html = document.documentElement
    const prev = html.getAttribute('data-theme')
    html.setAttribute('data-theme', 'light')
    return () => {
      html.setAttribute('data-theme', prev ?? 'dark')
    }
  }, [])

  return (
    <div className={`${styles.wrapper} lpRoot`}>
      <SiteHeader />
      <div className={styles.content}>
        <Hero />
        <Problem />
        <Features />
        <ShareIt />
        <FinalCta />
        <SiteFooter />
      </div>
    </div>
  )
}
