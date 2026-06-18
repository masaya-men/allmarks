'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './legal-page.module.css'

const SECTIONS = [
  'acceptance', 'service', 'responsibilities', 'ip', 'sharing',
  'warranty', 'liability', 'modifications', 'law', 'contact',
] as const

/**
 * Terms 本文(法務読み物・目次アンカー付き)。準拠法=日本/東京(維持)。
 * 共有=KV に一時アップロード+30日削除の事実を反映。スクロール演出なし。
 */
export function TermsContent(): React.ReactElement {
  const { t } = useI18n()
  return (
    <article className={styles.root}>
      <header className={styles.hero}>
        <p className={styles.kicker}>
          <span className={styles.kickerDot} aria-hidden="true" />
          {t('pages.terms.hero.kicker')}
        </p>
        <h1 className={styles.title}>{t('pages.terms.hero.title')}</h1>
        <p className={styles.lead}>{t('pages.terms.hero.lead')}</p>
        <p className={styles.updated}>{t('pages.terms.hero.updated')}</p>
      </header>

      <nav className={styles.toc} aria-label={t('pages.terms.toc.title')}>
        <p className={styles.tocTitle}>{t('pages.terms.toc.title')}</p>
        <ul className={styles.tocList}>
          {SECTIONS.map((id) => (
            <li key={id}>
              <a href={`#${id}`} className={styles.tocLink}>
                {t(`pages.terms.${id}.heading`)}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {SECTIONS.map((id) => (
        <section key={id} id={id} className={styles.section}>
          <h2 className={styles.heading}>{t(`pages.terms.${id}.heading`)}</h2>
          <p className={styles.body}>{t(`pages.terms.${id}.body`)}</p>
          {id === 'contact' && (
            <p className={styles.body}>
              <Link href="/contact" className={styles.link}>
                {t('pages.contact.hero.kicker')}
              </Link>
            </p>
          )}
        </section>
      ))}
    </article>
  )
}
