'use client'

import { useI18n } from '@/lib/i18n/I18nProvider'
import { renderLinkedText, type RichLinkTarget } from '@/lib/i18n/rich-text'
import styles from './legal-page.module.css'

const SECTIONS = ['firstPayment', 'renewalPayment', 'cancellation', 'afterRefund', 'howTo'] as const

/**
 * 返金ポリシー本文(新規ページ、s220)。Terms/Privacy と同じ法務読み物レイアウト
 * (legal-page.module.css を共用)。Paddle.com が販売者として返金窓口。
 * スクロール演出なし。
 */
export function RefundContent(): React.ReactElement {
  const { t } = useI18n()
  const links: Record<string, RichLinkTarget> = {
    paddleHome: { href: 'https://paddle.net' },
    supportEmail: { href: 'mailto:allmarks-support@googlegroups.com' },
  }

  return (
    <article className={styles.root}>
      <header className={styles.hero}>
        <p className={styles.kicker}>
          <span className={styles.kickerDot} aria-hidden="true" />
          {t('pages.refund.hero.kicker')}
        </p>
        <h1 className={styles.title}>{t('pages.refund.hero.title')}</h1>
        <p className={styles.lead}>{t('pages.refund.hero.lead')}</p>
        <p className={styles.updated}>{t('pages.refund.hero.updated')}</p>
      </header>

      <nav className={styles.toc} aria-label={t('pages.refund.toc.title')}>
        <p className={styles.tocTitle}>{t('pages.refund.toc.title')}</p>
        <ul className={styles.tocList}>
          {SECTIONS.map((id) => (
            <li key={id}>
              <a href={`#${id}`} className={styles.tocLink}>
                {t(`pages.refund.${id}.heading`)}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {SECTIONS.map((id) => (
        <section key={id} id={id} className={styles.section}>
          <h2 className={styles.heading}>{t(`pages.refund.${id}.heading`)}</h2>
          <p className={styles.body}>
            {id === 'howTo'
              ? renderLinkedText(t(`pages.refund.${id}.body`), links, styles.link)
              : t(`pages.refund.${id}.body`)}
          </p>
        </section>
      ))}
    </article>
  )
}
