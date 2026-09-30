'use client'

import { useI18n } from '@/lib/i18n/I18nProvider'
import { navHref } from '@/lib/i18n/locale-urls'
import { renderLinkedText, type RichLinkTarget } from '@/lib/i18n/rich-text'
import { PricingPlans } from './PricingPlans'
import styles from './pricing-page.module.css'

const FAQ_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5'] as const

/**
 * 料金ページ本文(s221)。approved mock の layout A(3カード)のみ実装。
 * 月払い/年払いはページ内 state(billing)で切り替え。Sync/Supporter の
 * 「申し込む」は Paddle Checkout(lib/billing/paddle-*)に接続済み — 対応する
 * env(NEXT_PUBLIC_PADDLE_*)が未設定の間は getPaddleCheckoutConfig が null を
 * 返すため、これまで通り disabled のまま。Free の CTA は /board へ
 * (他ページの Open Board 導線と同じ、locale 接頭辞なし)。
 */
export function PricingContent(): React.ReactElement {
  const { t, locale } = useI18n()

  const links: Record<string, RichLinkTarget> = {
    refund: { href: navHref(locale, 'refund') },
    paddleHome: { href: 'https://paddle.net' },
  }

  return (
    <article className={styles.root}>
      <header className={styles.hero}>
        <p className={styles.kicker}>
          <span className={styles.kickerDot} aria-hidden="true" />
          {t('pages.pricing.hero.kicker')}
        </p>
        <h1 className={styles.title}>{t('pages.pricing.hero.title')}</h1>
        <p className={styles.lead}>{t('pages.pricing.hero.lead')}</p>
      </header>

      <PricingPlans />

      <section className={styles.faq}>
        <h2 className={styles.faqHeading}>{t('pages.pricing.faq.heading')}</h2>
        {FAQ_KEYS.map((key) => (
          <div key={key} className={styles.qa}>
            <h3 className={styles.qaQ}>{t(`pages.pricing.faq.${key}.q`)}</h3>
            <p className={styles.qaA}>{renderLinkedText(t(`pages.pricing.faq.${key}.a`), links, styles.link)}</p>
          </div>
        ))}
        <p className={styles.taxNote}>{t('pages.pricing.taxNote')}</p>
      </section>
    </article>
  )
}
