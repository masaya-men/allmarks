'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './AboutContent.module.css'

const GITHUB_URL = 'https://github.com/masaya-men/allmarks'

/**
 * About 本文(編集的トーン)。番号なしの落ち着いたセクション群。
 * 文章は pages.about.* から。GitHub URL は allmarks リポ(偽メタデータ無し)。
 * 可視性はアニメ非依存(CSS 既定で全要素可視)。
 */
export function AboutContent(): React.ReactElement {
  const { t } = useI18n()
  return (
    <article className={styles.root}>
      <header className={styles.hero}>
        <p className={styles.kicker}>{t('pages.about.hero.kicker')}</p>
        <h1 className={styles.title}>{t('pages.about.hero.title')}</h1>
        <p className={styles.lead}>{t('pages.about.hero.lead')}</p>
      </header>

      <section className={styles.section}>
        <h2 className={styles.heading}>{t('pages.about.philosophy.heading')}</h2>
        <p className={styles.body}>{t('pages.about.philosophy.body')}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{t('pages.about.privacy.heading')}</h2>
        <p className={styles.body}>{t('pages.about.privacy.body')}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{t('pages.about.openSource.heading')}</h2>
        <p className={styles.body}>
          {t('pages.about.openSource.body')}{' '}
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={styles.link}>
            GitHub
          </a>
        </p>
      </section>

      <section className={styles.cta}>
        <h2 className={styles.ctaHeading}>{t('pages.about.cta.heading')}</h2>
        <Link href="/board" className={styles.ctaButton}>
          {t('pages.about.cta.button')}
          <span aria-hidden="true"> ↗</span>
        </Link>
      </section>
    </article>
  )
}
