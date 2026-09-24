'use client'

import { useI18n } from '@/lib/i18n/I18nProvider'
import { navHref } from '@/lib/i18n/locale-urls'
import { renderLinkedText, type RichLinkTarget } from '@/lib/i18n/rich-text'
import styles from './legal-page.module.css'

const SECTIONS = [
  'acceptance', 'service', 'responsibilities', 'ip', 'sharing', 'paidPlan',
  'warranty', 'liability', 'modifications', 'law', 'language', 'operator', 'contact',
] as const

/**
 * Terms 本文(法務読み物・目次アンカー付き)。準拠法=日本/東京(維持)。
 * 共有=KV に一時アップロード+30日削除の事実を反映。有料プラン(端末間同期)と
 * 運営者(Masaya Maeno)の節を含む(s220)。スクロール演出なし。
 */
export function TermsContent(): React.ReactElement {
  const { t, locale } = useI18n()
  const links: Record<string, RichLinkTarget> = {
    refund: { href: navHref(locale, 'refund') },
    supportEmail: { href: 'mailto:allmarks-support@googlegroups.com' },
    pricing: { href: navHref(locale, 'pricing') },
  }

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

          {id === 'paidPlan' && (
            <>
              <p className={styles.body}>
                {renderLinkedText(t('pages.terms.paidPlan.intro'), links, styles.link)}
              </p>
              <ul className={styles.list}>
                {(['item1', 'item2', 'item3', 'item4', 'item5'] as const).map((item) => (
                  <li key={item} className={styles.listItem}>
                    {renderLinkedText(t(`pages.terms.paidPlan.list.${item}`), links, styles.link)}
                  </li>
                ))}
              </ul>
            </>
          )}

          {id === 'operator' && (
            <>
              <p className={styles.body}>{t('pages.terms.operator.intro')}</p>
              <p className={styles.body}>
                {renderLinkedText(t('pages.terms.operator.emailLine'), links, styles.link)}
              </p>
            </>
          )}

          {id === 'contact' && (
            <p className={styles.body}>
              {renderLinkedText(t('pages.terms.contact.body'), links, styles.link)}
            </p>
          )}

          {id !== 'paidPlan' && id !== 'operator' && id !== 'contact' && (
            <p className={styles.body}>{t(`pages.terms.${id}.body`)}</p>
          )}
        </section>
      ))}
    </article>
  )
}
