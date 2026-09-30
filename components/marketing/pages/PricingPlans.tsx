'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { PLAN_PRICE, formatYen, monthlyEquivalent, type BillingCycle, type PaidPlanId } from '@/lib/pricing/plans'
import { getPaddleCheckoutConfig, type PaddleCheckoutConfig } from '@/lib/billing/paddle-config'
import { openPaddleCheckout } from '@/lib/billing/paddle-checkout'
import styles from './PricingPlans.module.css'

const FREE_ITEMS = ['item1', 'item2', 'item3'] as const
const SYNC_ITEMS = ['item1', 'item2', 'item3', 'item4'] as const
const MAX_TILT = 6

/**
 * Billing toggle + Free / Sync / Supporter cards (Paddle checkout wired).
 * Shared by the pricing page and the LP Sync section. Cards get a periodic
 * sheen and a pointer-following tilt (fine pointers only, off under reduced motion).
 */
export function PricingPlans(): React.ReactElement {
  const { t, locale } = useI18n()
  const [billing, setBilling] = useState<BillingCycle>('monthly')
  const cardsRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const root = cardsRef.current
    if (!root) return undefined
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!fine || reduce) return undefined
    const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-tilt]'))
    const cleanups = cards.map((card) => {
      const onMove = (e: PointerEvent): void => {
        const r = card.getBoundingClientRect()
        const px = (e.clientX - r.left) / r.width - 0.5
        const py = (e.clientY - r.top) / r.height - 0.5
        card.dataset.tilting = 'true'
        card.style.setProperty('--tilt-y', `${(px * 2 * MAX_TILT).toFixed(2)}deg`)
        card.style.setProperty('--tilt-x', `${(-py * 2 * MAX_TILT).toFixed(2)}deg`)
      }
      const onLeave = (): void => {
        card.dataset.tilting = 'false'
        card.style.setProperty('--tilt-x', '0deg')
        card.style.setProperty('--tilt-y', '0deg')
      }
      card.addEventListener('pointermove', onMove)
      card.addEventListener('pointerleave', onLeave)
      return () => {
        card.removeEventListener('pointermove', onMove)
        card.removeEventListener('pointerleave', onLeave)
      }
    })
    return () => cleanups.forEach((fn) => fn())
  }, [])

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
    <>
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

      <section ref={cardsRef} className={styles.cards}>
        {/* Free */}
        <article data-tilt className={`${styles.card} ${styles.cardFree}`}>
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
        <article data-tilt className={`${styles.card} ${styles.cardMain}`}>
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
        <article data-tilt className={styles.card}>
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
    </>
  )
}
