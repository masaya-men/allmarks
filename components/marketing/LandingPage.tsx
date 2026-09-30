'use client'

import { useEffect, useLayoutEffect } from 'react'
import type { SupportedLocale } from '@/lib/i18n/config'
import { useScrollTrigger } from '@/lib/scroll/use-scroll-trigger'
import { useSmoothScroll } from '@/lib/scroll/use-smooth-scroll'
import { BackgroundGrid } from './BackgroundGrid'
import { LandingFonts } from './LandingFonts'
import { LocaleSuggestBanner } from './LocaleSuggestBanner'
import { PageScrollMeter } from './PageScrollMeter'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { Hero } from './sections/Hero'
import { Problem } from './sections/Problem'
import { Tape } from './sections/Tape'
import { Features } from './sections/Features'
import { FinalCta } from './sections/FinalCta'
import { SyncPlan } from './sections/SyncPlan'
import './landing-tokens.css'
import './lp-art.css'
import styles from './LandingPage.module.css'

/**
 * LandingPage — root client component for the AllMarks marketing LP.
 *
 * Initialises GSAP ScrollTrigger, then renders the full editorial flow:
 *
 *   BackgroundGrid (fixed, 12-column hairline grid behind everything)
 *   PageScrollMeter (fixed z-index 50, right edge: page scroll meter — stands in for the standard
 *     scrollbar this page hides; outside .content on purpose so its difference blend sees the page)
 *   SiteHeader (fixed, transparent → scrolled; hidden during FinalCta)
 *   ─── white editorial ground (#faf9f6) ──────────────────────────────
 *   Hero        — product board-mock visual + headline + CTAs
 *   Problem     — the problem we solve
 *   Tape        — scrolling word band (Save · Arrange · Play · Tag · Share)
 *   Features    — 01-06 feature cards with live video grid
 *   SyncPlan    — paid sync plan + pricing link (ja only until translated)
 *   ─── white gives way to the finale's near-black ground (#0b0b0b) ──
 *   FinalCta    — rotating-circle "OPEN THE BOARD" climax + AllMarks marquee
 *   ─── black continues seamlessly ──────────────────────────────────
 *   SiteFooter  — dark editorial footer (#0a0a0a)
 */
export function LandingPage({ locale = 'en' }: { locale?: SupportedLocale }): React.ReactElement {
  useScrollTrigger()
  useSmoothScroll()

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

  // LP だけ標準のスクロールバーを隠す(右端の PageScrollMeter が代わりを務める)。マウント中だけ <html> に
  // 属性を付け、アンマウントで外すので、ほかのページには影響しない(landing-tokens.css の
  // html[data-lp-scrollbar='custom'])。useLayoutEffect なのは、バーが消えると本文の幅が変わる(リサイズ
  // イベントは飛ばない)ので、子の各区画が useEffect で寸法を測る「前」に消しておくため。
  useLayoutEffect(() => {
    const html = document.documentElement
    html.setAttribute('data-lp-scrollbar', 'custom')
    return () => {
      html.removeAttribute('data-lp-scrollbar')
    }
  }, [])

  return (
    <div className={`${styles.wrapper} lpRoot lpHome`} data-locale={locale}>
      <LandingFonts locale={locale} />
      <BackgroundGrid />
      <PageScrollMeter />
      <LocaleSuggestBanner current={locale} />
      <SiteHeader locale={locale} />
      <div className={styles.content}>
        <Hero />
        <Problem />
        <Tape />
        <Features />
        {(locale === 'ja' || locale === 'en') && <SyncPlan locale={locale} />}
        <FinalCta />
        <SiteFooter locale={locale} />
      </div>
    </div>
  )
}
