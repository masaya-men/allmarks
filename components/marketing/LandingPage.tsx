'use client'

import { useEffect } from 'react'
import type { SupportedLocale } from '@/lib/i18n/config'
import { useSmoothScroll } from '@/lib/scroll/use-smooth-scroll'
import { useScrollTrigger } from '@/lib/scroll/use-scroll-trigger'
import { LocaleSuggestBanner } from './LocaleSuggestBanner'
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
export function LandingPage({ locale = 'en' }: { locale?: SupportedLocale }): React.ReactElement {
  useSmoothScroll()
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
    <div className={`${styles.wrapper} lpRoot`}>
      <LocaleSuggestBanner current={locale} />
      <SiteHeader locale={locale} />
      <div className={styles.content}>
        <Hero />
        <Problem />
        <Features />
        <ShareIt />
        <FinalCta />
        <SiteFooter locale={locale} />
      </div>
    </div>
  )
}
