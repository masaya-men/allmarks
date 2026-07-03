'use client'

import { useEffect } from 'react'
import type { SupportedLocale } from '@/lib/i18n/config'
import { useSmoothScroll } from '@/lib/scroll/use-smooth-scroll'
import { NAV_ITEMS, SiteHeader } from './SiteHeader'
import { NavDockTraveler } from './NavDockTraveler'
import { SiteFooter } from './SiteFooter'
import './landing-tokens.css'
import styles from './MarketingShell.module.css'

/**
 * 紹介ページ共有シェル(LP と同じ編集的トーン)。
 * - lpRoot + SiteHeader(上部透明→スクロールで半透明) + 本文 + SiteFooter(黒)。
 * - mount 中 <html lang>=locale, data-theme=light(ダーク強制対策、LP と同パターン)。
 * - Lenis 慣性スクロール(トップ LP と感触統一・reduced-motion では自動 no-op)。
 * - ナビ5ページでは N-05 traveler(kicker→ナビ格納演出)をマウント。
 */
export function MarketingShell({
  locale,
  subpath,
  children,
}: {
  locale: SupportedLocale
  subpath?: string
  children: React.ReactNode
}): React.ReactElement {
  useSmoothScroll()
  const dockItem = NAV_ITEMS.find((item) => item.subpath === subpath)

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
      <SiteHeader locale={locale} subpath={subpath} />
      {dockItem ? <NavDockTraveler label={dockItem.label} /> : null}
      <main className={styles.main}>{children}</main>
      <SiteFooter locale={locale} />
    </div>
  )
}
