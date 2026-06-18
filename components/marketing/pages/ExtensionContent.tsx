'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { useReveal } from '@/lib/scroll/use-reveal'
import { EXTENSION_STORE_URL } from '@/lib/board/constants'
import { navHref } from '@/lib/i18n/locale-urls'
import type { SupportedLocale } from '@/lib/i18n/config'
import styles from './intro-page.module.css'

/**
 * Extension 紹介本文。EXTENSION_STORE_URL が空の間は「ストア準備中・今は
 * ブックマークレットで」バナーを出し、死んだストアリンクを出さない(値が入れば
 * 自動でストアボタン点灯)。プライバシーリンクは locale に応じた言語別 URL。
 * 事実は §確定済みプロダクト事実に準拠。可視性はアニメ非依存。
 */
export function ExtensionContent({ locale }: { locale: SupportedLocale }): React.ReactElement {
  const { t } = useI18n()
  const rootRef = useRef<HTMLElement>(null)
  useReveal(rootRef as React.RefObject<HTMLElement>, { y: 24, stagger: 0.1 })

  const hasStore = EXTENSION_STORE_URL !== ''
  const sections = ['what', 'how', 'sites'] as const

  return (
    <article ref={rootRef} className={styles.root}>
      <header className={styles.hero}>
        <p className={styles.kicker} data-reveal>
          <span className={styles.kickerDot} aria-hidden="true" />
          {t('pages.extension.hero.kicker')}
        </p>
        <h1 className={styles.title} data-reveal>{t('pages.extension.hero.title')}</h1>
        <p className={styles.lead} data-reveal>{t('pages.extension.hero.lead')}</p>
      </header>

      {!hasStore && (
        <aside className={styles.banner} data-reveal>
          <p className={styles.bannerHeading}>
            <span className={styles.kickerDot} aria-hidden="true" />
            {t('pages.extension.status.label')}
          </p>
          <p className={styles.bannerBody}>{t('pages.extension.status.body')}</p>
        </aside>
      )}

      <div className={styles.sections}>
        {sections.map((key) => (
          <section key={key} className={styles.section} data-reveal>
            <div className={styles.sectionIndex}>
              <span className={styles.sectionNum}>{t(`pages.extension.${key}.num`)}</span>
              <span className={styles.sectionTick} aria-hidden="true" />
            </div>
            <div className={styles.sectionBody}>
              <h2 className={styles.heading}>{t(`pages.extension.${key}.heading`)}</h2>
              <p className={styles.body}>{t(`pages.extension.${key}.body`)}</p>
            </div>
          </section>
        ))}

        <section className={styles.section} data-reveal>
          <div className={styles.sectionIndex}>
            <span className={styles.sectionNum}>{t('pages.extension.privacy.num')}</span>
            <span className={styles.sectionTick} aria-hidden="true" />
          </div>
          <div className={styles.sectionBody}>
            <h2 className={styles.heading}>{t('pages.extension.privacy.heading')}</h2>
            <p className={styles.body}>
              {t('pages.extension.privacy.body')}{' '}
              <Link href={navHref(locale, 'extension/privacy')} className={styles.link}>
                {t('pages.extensionPrivacy.hero.kicker')}
              </Link>
            </p>
          </div>
        </section>
      </div>

      <section className={styles.cta} data-reveal>
        <span className={styles.ctaRule} aria-hidden="true" />
        <h2 className={styles.ctaHeading}>{t('pages.extension.cta.heading')}</h2>
        <Link href="/board" className={styles.ctaLink}>
          {t('pages.extension.cta.button')}
          <span className={styles.ctaArrow} aria-hidden="true">↗</span>
        </Link>
      </section>
    </article>
  )
}
