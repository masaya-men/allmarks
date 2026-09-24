'use client'

import { useI18n } from '@/lib/i18n/I18nProvider'
import { navHref } from '@/lib/i18n/locale-urls'
import { renderLinkedText, type RichLinkTarget } from '@/lib/i18n/rich-text'
import styles from './legal-page.module.css'

const GITHUB_ISSUES_URL = 'https://github.com/masaya-men/allmarks/issues'
const SUPPORT_EMAIL = 'allmarks-support@googlegroups.com'

const BILLING_ITEMS = ['item1', 'item2', 'item3', 'item4'] as const

/**
 * Contact 本文(短い中央寄せ)。有料プラン(Paddle 窓口)・メール・GitHub Issues・
 * セキュリティの4ブロック(s220、旧フィードバック欄は廃止)。スクロール演出なし。
 */
export function ContactContent(): React.ReactElement {
  const { t, locale } = useI18n()
  const links: Record<string, RichLinkTarget> = {
    faq: { href: navHref(locale, 'faq') },
    paddleHome: { href: 'https://paddle.net' },
  }

  return (
    <article className={styles.root}>
      <header className={styles.hero}>
        <p className={styles.kicker} data-nav-dock-anchor>
          <span className={styles.kickerDot} aria-hidden="true" />
          {t('pages.contact.hero.kicker')}
        </p>
        <h1 className={styles.title}>{t('pages.contact.hero.title')}</h1>
        <p className={styles.lead}>{renderLinkedText(t('pages.contact.hero.lead'), links, styles.link)}</p>
      </header>

      <div className={styles.contactBlock}>
        <section className={styles.contactItem}>
          <p className={styles.contactLabel}>{t('pages.contact.billing.label')}</p>
          <p className={styles.contactValue}>
            {renderLinkedText(t('pages.contact.billing.body'), links, styles.link)}
          </p>
          <ul className={styles.list}>
            {BILLING_ITEMS.map((item) => (
              <li key={item} className={styles.listItem}>
                {t(`pages.contact.billing.list.${item}`)}
              </li>
            ))}
          </ul>
        </section>
        <section className={styles.contactItem}>
          <p className={styles.contactLabel}>{t('pages.contact.email.label')}</p>
          <p className={styles.contactValue}>
            {t('pages.contact.email.body')}{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className={styles.link}>
              {SUPPORT_EMAIL}
            </a>
          </p>
        </section>
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
          <p className={styles.contactLabel}>{t('pages.contact.security.label')}</p>
          <p className={styles.contactValue}>{t('pages.contact.security.body')}</p>
        </section>
      </div>
    </article>
  )
}
