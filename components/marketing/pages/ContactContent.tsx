'use client'

import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './legal-page.module.css'

const GITHUB_ISSUES_URL = 'https://github.com/masaya-men/allmarks/issues'

/**
 * Contact 本文(短い中央寄せ)。GitHub Issues 中心・X 欄なし・個人メアド非掲載
 * (確定方針)。スクロール演出なし。
 */
export function ContactContent(): React.ReactElement {
  const { t } = useI18n()
  return (
    <article className={styles.root}>
      <header className={styles.hero}>
        <p className={styles.kicker} data-nav-dock-anchor>
          <span className={styles.kickerDot} aria-hidden="true" />
          {t('pages.contact.hero.kicker')}
        </p>
        <h1 className={styles.title}>{t('pages.contact.hero.title')}</h1>
        <p className={styles.lead}>{t('pages.contact.hero.lead')}</p>
      </header>

      <div className={styles.contactBlock}>
        <section className={styles.contactItem}>
          <p className={styles.contactLabel}>{t('pages.contact.github.label')}</p>
          <p className={styles.contactValue}>
            {t('pages.contact.github.body')}{' '}
            <a href={GITHUB_ISSUES_URL} target="_blank" rel="noopener noreferrer" className={styles.link}>
              github.com/masaya-men/allmarks/issues
            </a>
          </p>
        </section>
        <section className={styles.contactItem}>
          <p className={styles.contactLabel}>{t('pages.contact.feedback.label')}</p>
          <p className={styles.contactValue}>{t('pages.contact.feedback.body')}</p>
        </section>
        <section className={styles.contactItem}>
          <p className={styles.contactLabel}>{t('pages.contact.security.label')}</p>
          <p className={styles.contactValue}>{t('pages.contact.security.body')}</p>
        </section>
      </div>
    </article>
  )
}
