'use client'

import { useEffect } from 'react'
import type { SupportedLocale } from '@/lib/i18n/config'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import './landing-tokens.css'
import styles from './MarketingShell.module.css'

/**
 * 紹介ページ共有シェル(LP と同じ編集的トーン)。
 * - lpRoot + SiteHeader(上部透明→スクロールで半透明) + 本文 + SiteFooter(黒)。
 * - mount 中 <html lang>=locale, data-theme=light(ダーク強制対策、LP と同パターン)。
 * - スクロール演出(pin/scrub)は持たない。本文側で use-reveal を任意使用。
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
      <main className={styles.main}>{children}</main>
      <SiteFooter locale={locale} />
    </div>
  )
}
