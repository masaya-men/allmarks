'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { useReveal } from '@/lib/scroll/use-reveal'
import styles from './intro-page.module.css'

/**
 * Guide 本文(番号付きの手順 + 末尾にトラブル対処)。
 * 事実は §確定済みプロダクト事実に準拠。可視性はアニメ非依存。
 */
export function GuideContent(): React.ReactElement {
  const { t } = useI18n()
  const rootRef = useRef<HTMLElement>(null)
  useReveal(rootRef as React.RefObject<HTMLElement>, { y: 24, stagger: 0.1 })

  const steps = ['start', 'save', 'arrange', 'play', 'share', 'data'] as const

  return (
    <article ref={rootRef} className={styles.root}>
      <header className={styles.hero}>
        <p className={styles.kicker} data-reveal data-nav-dock-anchor>
          <span className={styles.kickerDot} aria-hidden="true" />
          {t('pages.guide.hero.kicker')}
        </p>
        <h1 className={styles.title} data-reveal>{t('pages.guide.hero.title')}</h1>
        <p className={styles.lead} data-reveal>{t('pages.guide.hero.lead')}</p>
      </header>

      <div className={styles.sections}>
        {steps.map((key) => (
          <section key={key} className={styles.section} data-reveal>
            <div className={styles.sectionIndex}>
              <span className={styles.sectionNum}>{t(`pages.guide.${key}.num`)}</span>
              <span className={styles.sectionTick} aria-hidden="true" />
            </div>
            <div className={styles.sectionBody}>
              <h2 className={styles.heading}>{t(`pages.guide.${key}.heading`)}</h2>
              <p className={styles.body}>{t(`pages.guide.${key}.body`)}</p>
            </div>
          </section>
        ))}

        <section className={styles.section} data-reveal>
          <div className={styles.sectionIndex}>
            <span className={styles.sectionTick} aria-hidden="true" />
          </div>
          <div className={styles.sectionBody}>
            <h2 className={styles.heading}>{t('pages.guide.trouble.heading')}</h2>
            <p className={styles.body}>{t('pages.guide.trouble.body')}</p>
          </div>
        </section>
      </div>

      <section className={styles.cta} data-reveal>
        <span className={styles.ctaRule} aria-hidden="true" />
        <h2 className={styles.ctaHeading}>{t('pages.guide.cta.heading')}</h2>
        <Link href="/board" className={styles.ctaLink}>
          {t('pages.guide.cta.button')}
          <span className={styles.ctaArrow} aria-hidden="true">↗</span>
        </Link>
      </section>
    </article>
  )
}
