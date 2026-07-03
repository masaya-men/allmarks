'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import type { SupportedLocale } from '@/lib/i18n/config'
import { localePath, navHref } from '@/lib/i18n/locale-urls'
import { LanguageMenu } from './LanguageMenu'
import styles from './SiteHeader.module.css'

/**
 * SiteHeader — LP editorial header.
 *
 * At rest (top of page): fully transparent, text in --lp-ink, floats over
 * the Hero's white ground without visual weight.
 * On scroll: a subtle translucent off-white bar with a hairline border and
 * light backdrop blur slides in — the header "arrives" as the user descends.
 *
 * Transitions use CSS alone (class toggle via JS scroll listener), no GSAP,
 * keeping this purely declarative and static-export safe.
 *
 * No ThemeToggle on the LP — the LP is a fixed editorial context (white →
 * black) and a theme toggle would fight the intentional flow.
 */

export const NAV_ITEMS = [
  { subpath: 'features', label: 'Features' },
  { subpath: 'guide',    label: 'Guide'    },
  { subpath: 'about',    label: 'About'    },
  { subpath: 'faq',      label: 'FAQ'      },
  { subpath: 'contact',  label: 'Contact'  },
] as const

export function SiteHeader({
  locale,
  subpath,
}: {
  locale: SupportedLocale
  subpath?: string
}): React.ReactElement {
  const headerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = headerRef.current
    if (!el) return

    // 最下部の黒幕（footer finale）。トップLPでは footer が z-index:1 の
    // 文脈内にあり z ではヘッダーを覆えないため、幕が画面上端まで来たら
    // ヘッダー自身が退場して「ヘッダーごと真っ黒」を成立させる。
    const finale = document.querySelector<HTMLElement>('[data-footer-finale]')

    let ticking = false
    const onScroll = (): void => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        if (!el) return
        const scrolled = window.scrollY > 32
        el.setAttribute('data-scrolled', scrolled ? 'true' : 'false')
        const covered = finale !== null && finale.getBoundingClientRect().top <= 8
        el.setAttribute('data-finale-covered', covered ? 'true' : 'false')
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    // Set initial state
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header ref={headerRef} className={styles.header} data-scrolled="false">
      <Link href={localePath(locale)} className={styles.logo} aria-label="AllMarks home">
        AllMarks
      </Link>

      <nav className={styles.nav} aria-label="Primary navigation">
        {NAV_ITEMS.map((item) => {
          // N-05: 現在ページの語は NavDockTraveler が本文から運んでくる。
          // html[data-nav-dock] が立っている間だけ CSS がスロット(ghost)に切替える。
          const isDockSlot = item.subpath === subpath
          return (
            <Link key={item.subpath} href={navHref(locale, item.subpath)} className={styles.navLink}>
              {isDockSlot ? (
                <>
                  <span className={styles.navLabelPlain}>{item.label}</span>
                  <span className={styles.dockSlot} data-nav-dock-target aria-hidden="true">
                    <span className={styles.slotDot} />
                    {item.label}
                  </span>
                </>
              ) : (
                item.label
              )}
            </Link>
          )
        })}
        <Link href="/board" className={styles.openApp}>
          Open Board
          <span className={styles.openArrow} aria-hidden="true">↗</span>
        </Link>
        <LanguageMenu current={locale} subpath={subpath} />
      </nav>
    </header>
  )
}
