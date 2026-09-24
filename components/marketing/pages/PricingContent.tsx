'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { navHref } from '@/lib/i18n/locale-urls'
import { renderLinkedText, type RichLinkTarget } from '@/lib/i18n/rich-text'
import { PLAN_PRICE, formatYen, monthlyEquivalent, type BillingCycle, type PaidPlanId } from '@/lib/pricing/plans'
import { getPaddleCheckoutConfig, type PaddleCheckoutConfig } from '@/lib/billing/paddle-config'
import { openPaddleCheckout } from '@/lib/billing/paddle-checkout'
import styles from './pricing-page.module.css'

const FAQ_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5'] as const
const FREE_ITEMS = ['item1', 'item2', 'item3'] as const
const SYNC_ITEMS = ['item1', 'item2', 'item3', 'item4'] as const

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
  const [billing, setBilling] = useState<BillingCycle>('monthly')

  const links: Record<string, RichLinkTarget> = {
    refund: { href: navHref(locale, 'refund') },
    paddleHome: { href: 'https://paddle.net' },
  }

  function planLabel(id: 'free' | 'sync' | 'supporter'): string {
    const name = t(`pages.pricing.${id}.name`)
    return locale === 'en' ? name : `${id.toUpperCase()} / ${name}`
  }

  function priceAmount(id: PaidPlanId): string {
    const price = PLAN_PRICE[id]
    return billing === 'monthly' ? formatYen(price.monthly) : formatYen(price.annual)
  }

  function pricePer(): string {
    return billing === 'monthly' ? t('pages.pricing.perMonth') : t('pages.pricing.perYear')
  }

  function altLine(id: PaidPlanId): string {
    const price = PLAN_PRICE[id]
    if (billing === 'monthly') {
      return t(`pages.pricing.${id}.altMonthly`).replace('{price}', formatYen(price.annual))
    }
    return t(`pages.pricing.${id}.altAnnual`).replace('{price}', formatYen(monthlyEquivalent(price.annual)))
  }

  // Paddle 未設定(env 未投入)の間は null → ボタンは今まで通り disabled のまま。
  const syncCheckout = getPaddleCheckoutConfig('sync', billing)
  const supporterCheckout = getPaddleCheckoutConfig('supporter', billing)

  async function handleSubscribe(config: PaddleCheckoutConfig): Promise<void> {
    try {
      await openPaddleCheckout(config, locale)
    } catch {
      // paddle.js の読み込み失敗等。失敗時専用の表示文言は未確定のため、
      // 現状はボタンを押せる状態のまま(再クリックで再試行可能)にする。
    }
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

      <div className={styles.toggle} role="group" aria-label={t('pages.pricing.toggle.groupLabel')}>
        <button
          type="button"
          className={styles.toggleButton}
          aria-pressed={billing === 'monthly'}
          onClick={() => setBilling('monthly')}
        >
          {t('pages.pricing.toggle.monthly')}
        </button>
        <button
          type="button"
          className={styles.toggleButton}
          aria-pressed={billing === 'annual'}
          onClick={() => setBilling('annual')}
        >
          {t('pages.pricing.toggle.annual')}
          <span className={styles.badge}>{t('pages.pricing.toggle.badge')}</span>
        </button>
      </div>

      <section className={styles.cards}>
        {/* Free */}
        <article className={`${styles.card} ${styles.cardFree}`}>
          <p className={styles.planName}>{planLabel('free')}</p>
          <p className={styles.price}>¥0</p>
          <p className={styles.alt} aria-hidden="true" />
          <ul className={styles.list}>
            {FREE_ITEMS.map((item) => (
              <li key={item} className={styles.listItem}>
                {t(`pages.pricing.free.list.${item}`)}
              </li>
            ))}
          </ul>
          <Link href="/board" className={styles.cta}>
            {t('pages.pricing.free.cta')}
          </Link>
        </article>

        {/* Sync — emphasized */}
        <article className={`${styles.card} ${styles.cardMain}`}>
          <p className={styles.planName}>
            <span className={styles.planDot} aria-hidden="true" />
            {planLabel('sync')}
          </p>
          <p className={styles.price}>
            {priceAmount('sync')}
            <span className={styles.per}>{pricePer()}</span>
          </p>
          <p className={styles.alt}>{altLine('sync')}</p>
          <ul className={styles.list}>
            {SYNC_ITEMS.map((item) => (
              <li key={item} className={styles.listItem}>
                {t(`pages.pricing.sync.list.${item}`)}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className={`${styles.cta} ${styles.ctaMain}${syncCheckout ? '' : ` ${styles.ctaDisabled}`}`}
            disabled={!syncCheckout}
            aria-disabled={!syncCheckout}
            onClick={syncCheckout ? () => void handleSubscribe(syncCheckout) : undefined}
          >
            {t('pages.pricing.cta.subscribe')}
          </button>
        </article>

        {/* Supporter */}
        <article className={styles.card}>
          <p className={styles.planName}>{planLabel('supporter')}</p>
          <p className={styles.price}>
            {priceAmount('supporter')}
            <span className={styles.per}>{pricePer()}</span>
          </p>
          <p className={styles.alt}>{altLine('supporter')}</p>
          <p className={styles.note}>{t('pages.pricing.supporter.note')}</p>
          <button
            type="button"
            className={`${styles.cta}${supporterCheckout ? '' : ` ${styles.ctaDisabled}`}`}
            disabled={!supporterCheckout}
            aria-disabled={!supporterCheckout}
            onClick={supporterCheckout ? () => void handleSubscribe(supporterCheckout) : undefined}
          >
            {t('pages.pricing.cta.subscribe')}
          </button>
        </article>
      </section>

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
