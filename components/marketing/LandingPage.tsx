'use client'

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
