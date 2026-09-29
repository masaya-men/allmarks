'use client'

import { useEffect } from 'react'
import type { SupportedLocale } from '@/lib/i18n/config'
import { useScrollTrigger } from '@/lib/scroll/use-scroll-trigger'
import { BackgroundGrid } from './BackgroundGrid'
import { LocaleSuggestBanner } from './LocaleSuggestBanner'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { Hero } from './sections/Hero'
import { Problem } from './sections/Problem'
import { Tape } from './sections/Tape'
import { Features } from './sections/Features'
import { FinalCta } from './sections/FinalCta'
import './landing-tokens.css'
import './lp-art.css'
import styles from './LandingPage.module.css'

/**
 * LandingPage — root client component for the AllMarks marketing LP.
 *
 * Initialises GSAP ScrollTrigger, then renders the full editorial flow:
 *
 *   BackgroundGrid (fixed, 12-column hairline grid behind everything)
 *   SiteHeader (fixed, transparent → scrolled; hidden during FinalCta)
 *   ─── white editorial ground (#faf9f6) ──────────────────────────────
 *   Hero        — product board-mock visual + headline + CTAs
 *   Problem     — the problem we solve
 *   Tape        — scrolling word band (Save · Arrange · Play · Tag · Share)
 *   Features    — 01-06 feature cards with live video grid
 *   ─── white gives way to the finale's near-black ground (#0b0b0b) ──
 *   FinalCta    — rotating-circle "OPEN THE BOARD" climax + AllMarks marquee
 *   ─── black continues seamlessly ──────────────────────────────────
 *   SiteFooter  — dark editorial footer (#0a0a0a)
 */
export function LandingPage({ locale = 'en' }: { locale?: SupportedLocale }): React.ReactElement {
  useScrollTrigger()

  // LP は意図的に LIGHT。app 既定 <html data-theme="dark"> + ブラウザ自動ダーク対策。
  // 併せて各言語ページの <html lang> を locale に合わせる(root layout は en 固定のため)。
  useEffect(() => {
    const html = document.documentElement
    const prevTheme = html.getAttribute('data-theme')
    const prevLang = html.getAttribute('lang')
    html.setAttribute('data-theme', 'light')
    html.setAttribute('lang', locale)
    return () => {
      html.setAttribute('data-theme', prevTheme ?? 'dark')
      html.setAttribute('lang', prevLang ?? 'en')
    }
  }, [locale])

  return (
    <div className={`${styles.wrapper} lpRoot lpHome`} data-locale={locale}>
      <BackgroundGrid />
      <LocaleSuggestBanner current={locale} />
      <SiteHeader locale={locale} />
      <div className={styles.content}>
        <Hero />
        <Problem />
        <Tape />
        <Features />
        <FinalCta />
        <SiteFooter locale={locale} />
      </div>
    </div>
  )
}
