'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { useReveal } from '@/lib/scroll/use-reveal'
import styles from './intro-page.module.css'

/**
 * Features 本文(編集トーン・番号付きセクション)。
 * 文章は pages.features.* から。事実は §確定済みプロダクト事実に準拠(偽メタデータ・
 * 複数同時再生の誇張をしない)。可視性はアニメ非依存(CSS 既定で全要素可視、
 * data-reveal は PC のみ fade)。
 */
export function FeaturesContent(): React.ReactElement {
  const { t } = useI18n()
  const rootRef = useRef<HTMLElement>(null)
  useReveal(rootRef as React.RefObject<HTMLElement>, { y: 24, stagger: 0.1 })

  const sections = ['save', 'board', 'motion', 'share', 'privacy'] as const

  return (
    <article ref={rootRef} className={styles.root}>
      <header className={styles.hero}>
        <p className={styles.kicker} data-reveal data-nav-dock-anchor>
          <span className={styles.kickerDot} aria-hidden="true" />
          {t('pages.features.hero.kicker')}
        </p>
        <h1 className={styles.title} data-reveal>{t('pages.features.hero.title')}</h1>
        <p className={styles.lead} data-reveal>{t('pages.features.hero.lead')}</p>
      </header>

      <div className={styles.sections}>
        {sections.map((key) => (
          <section key={key} className={styles.section} data-reveal>
            <div className={styles.sectionIndex}>
              <span className={styles.sectionNum}>{t(`pages.features.${key}.num`)}</span>
              <span className={styles.sectionTick} aria-hidden="true" />
            </div>
            <div className={styles.sectionBody}>
              <h2 className={styles.heading}>{t(`pages.features.${key}.heading`)}</h2>
              <p className={styles.body}>{t(`pages.features.${key}.body`)}</p>
            </div>
          </section>
        ))}

        <section className={styles.section} data-reveal>
          <div className={styles.sectionIndex}>
            <span className={styles.sectionNum}>06</span>
            <span className={styles.sectionTick} aria-hidden="true" />
          </div>
          <div className={styles.sectionBody}>
            <h2 className={styles.heading}>{t('pages.features.sites.heading')}</h2>
            <p className={styles.body}>{t('pages.features.sites.body')}</p>
            <p className={styles.note}>{t('pages.features.sites.note')}</p>
          </div>
        </section>
      </div>

      <section className={styles.cta} data-reveal>
        <span className={styles.ctaRule} aria-hidden="true" />
        <h2 className={styles.ctaHeading}>{t('pages.features.cta.heading')}</h2>
        <Link href="/board" className={styles.ctaLink}>
          {t('pages.features.cta.button')}
          <span className={styles.ctaArrow} aria-hidden="true">↗</span>
        </Link>
      </section>
    </article>
  )
}
