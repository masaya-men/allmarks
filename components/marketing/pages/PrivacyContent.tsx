'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { navHref } from '@/lib/i18n/locale-urls'
import { renderLinkedText, type RichLinkTarget } from '@/lib/i18n/rich-text'
import styles from './legal-page.module.css'

/** privacy/terms 共通: セクション定義(anchor id = key)。 */
const SECTIONS = [
  'philosophy', 'collect', 'local', 'deviceSync', 'syncKeys', 'payment', 'sharing',
  'bookmarklet', 'extension', 'hosting', 'thirdParty', 'advertising', 'children',
  'changes', 'contact',
] as const

const GOOGLE_DATA_POLICY_URL = 'https://developers.google.com/terms/api-services-user-data-policy'

/**
 * Privacy 本文(法務読み物・目次アンカー付き)。事実は §確定済みプロダクト事実に準拠。
 * 共有は KV/R2 に30日保存される事実を正しく書く(旧ページの「送らない」誤りを継承しない)。
 * 端末間同期(有料プラン)・同期キーと端末数・お支払いの節を含む(s220)。
 * スクロール演出なし(全要素可視)。
 */
export function PrivacyContent(): React.ReactElement {
  const { t, locale } = useI18n()
  const links: Record<string, RichLinkTarget> = {
    paymentSection: { href: '#payment' },
    googleDataPolicy: { href: GOOGLE_DATA_POLICY_URL },
    supportEmail: { href: 'mailto:allmarks-support@googlegroups.com' },
  }

  return (
    <article className={styles.root}>
      <header className={styles.hero}>
        <p className={styles.kicker}>
          <span className={styles.kickerDot} aria-hidden="true" />
          {t('pages.privacy.hero.kicker')}
        </p>
        <h1 className={styles.title}>{t('pages.privacy.hero.title')}</h1>
        <p className={styles.lead}>{t('pages.privacy.hero.lead')}</p>
        <p className={styles.updated}>{t('pages.privacy.hero.updated')}</p>
      </header>

      <nav className={styles.toc} aria-label={t('pages.privacy.toc.title')}>
        <p className={styles.tocTitle}>{t('pages.privacy.toc.title')}</p>
        <ul className={styles.tocList}>
          {SECTIONS.map((id) => (
            <li key={id}>
              <a href={`#${id}`} className={styles.tocLink}>
                {t(`pages.privacy.${id}.heading`)}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {SECTIONS.map((id) => (
        <section key={id} id={id} className={styles.section}>
          <h2 className={styles.heading}>{t(`pages.privacy.${id}.heading`)}</h2>

          {id === 'collect' && (
            <p className={styles.body}>
              {renderLinkedText(t('pages.privacy.collect.body'), links, styles.link)}
            </p>
          )}

          {id === 'deviceSync' && (
            <>
              <p className={styles.body}>{t('pages.privacy.deviceSync.para1')}</p>
              <p className={styles.body}>{t('pages.privacy.deviceSync.para2')}</p>
              <p className={styles.body}>
                {renderLinkedText(t('pages.privacy.deviceSync.para3'), links, styles.link)}
              </p>
            </>
          )}

          {id === 'payment' && (
            <>
              <p className={styles.body}>{t('pages.privacy.payment.para1')}</p>
              <p className={styles.body}>{t('pages.privacy.payment.para2')}</p>
            </>
          )}

          {id === 'contact' && (
            <p className={styles.body}>
              {renderLinkedText(t('pages.privacy.contact.body'), links, styles.link)}
            </p>
          )}

          {id !== 'collect' && id !== 'deviceSync' && id !== 'payment' && id !== 'contact' && (
            <p className={styles.body}>{t(`pages.privacy.${id}.body`)}</p>
          )}

          {id === 'extension' && (
            <p className={styles.body}>
              <Link href={navHref(locale, 'extension/privacy')} className={styles.link}>
                {t('pages.extensionPrivacy.hero.kicker')}
              </Link>
            </p>
          )}
        </section>
      ))}
    </article>
  )
}
