'use client'

import Link from 'next/link'
import type { SupportedLocale } from '@/lib/i18n/config'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { localePath, navHref } from '@/lib/i18n/locale-urls'
import styles from './SiteFooter.module.css'

/**
 * SiteFooter — dark footer that continues the FinalCta's near-black ground.
 *
 * Background: #0a0a0a (same as the FinalCta overlay end-state).
 * Text: off-white #f0efe9 / muted rgba variant.
 *
 * The footer is the last thing on the page: the page ends at the © row of the
 * bottom strip. There is no closing full-screen "Open Board" panel after it
 * (removed) — the Product column still links to /board.
 *
 * Nav labels sourced from useI18n() landing.footer.* keys — correctly shows
 * English when the LP runs without an I18nProvider (FALLBACK is English).
 * NO tilt. Minimal, refined editorial tone.
 */
export function SiteFooter({ locale = 'en' }: { locale?: SupportedLocale }): React.ReactElement {
  const { t } = useI18n()

  return (
    <footer className={styles.footer}>

      <div className={styles.inner}>

        {/* Brand column */}
        <div className={styles.brandColumn}>
          <Link href={localePath(locale)} className={styles.brand} aria-label="AllMarks home">
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
                <Link href={navHref(locale, 'features')} className={styles.link}>
                  {t('landing.footer.features')}
                </Link>
              </li>
              <li>
                <Link href={navHref(locale, 'guide')} className={styles.link}>
                  {t('landing.footer.guide')}
                </Link>
              </li>
              <li>
                <Link href={navHref(locale, 'pricing')} className={styles.link}>
                  {t('landing.footer.pricing')}
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
                <Link href={navHref(locale, 'about')} className={styles.link}>
                  {t('landing.footer.about')}
                </Link>
              </li>
              <li>
                <Link href={navHref(locale, 'faq')} className={styles.link}>
                  {t('landing.footer.faq')}
                </Link>
              </li>
              <li>
                <Link href={navHref(locale, 'contact')} className={styles.link}>
                  {t('landing.footer.contact')}
                </Link>
              </li>
            </ul>
          </div>

          <div className={styles.column}>
            <h3 className={styles.colHeading}>Legal</h3>
            <ul className={styles.list}>
              <li>
                <Link href={navHref(locale, 'privacy')} className={styles.link}>
                  {t('landing.footer.privacy')}
                </Link>
              </li>
              <li>
                <Link href={navHref(locale, 'terms')} className={styles.link}>
                  {t('landing.footer.terms')}
                </Link>
              </li>
              <li>
                <Link href={navHref(locale, 'refund')} className={styles.link}>
                  {t('landing.footer.refund')}
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
