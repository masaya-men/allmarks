'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { navHref } from '@/lib/i18n/locale-urls'
import { renderLinkedText, type RichLinkTarget } from '@/lib/i18n/rich-text'
import { useReveal } from '@/lib/scroll/use-reveal'
import styles from './intro-page.module.css'

// q1..q9 = 既存(一部 s220 で文面更新)。q10-14=同期、q15-19=お支払い・契約、
// q20-21=うまくいかないとき(s220 で追加)。
const QUESTION_KEYS = [
  'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9',
  'q10', 'q11', 'q12', 'q13', 'q14',
  'q15', 'q16', 'q17', 'q18', 'q19',
  'q20', 'q21',
] as const

/**
 * FAQ 本文(Q&A リスト)。事実は §確定済みプロダクト事実に準拠。
 * 可視性はアニメ非依存。
 */
export function FaqContent(): React.ReactElement {
  const { t, locale } = useI18n()
  const rootRef = useRef<HTMLElement>(null)
  useReveal(rootRef as React.RefObject<HTMLElement>, { y: 22, stagger: 0.08 })

  const links: Record<string, RichLinkTarget> = {
    refund: { href: navHref(locale, 'refund') },
    paddleHome: { href: 'https://paddle.net' },
    pricing: { href: navHref(locale, 'pricing') },
  }

  return (
    <article ref={rootRef} className={styles.root}>
      <header className={styles.hero}>
        <p className={styles.kicker} data-reveal data-nav-dock-anchor>
          <span className={styles.kickerDot} aria-hidden="true" />
          {t('pages.faq.hero.kicker')}
        </p>
        <h1 className={styles.title} data-reveal>{t('pages.faq.hero.title')}</h1>
        <p className={styles.lead} data-reveal>{t('pages.faq.hero.lead')}</p>
      </header>

      <div className={styles.qaList}>
        {QUESTION_KEYS.map((key) => (
          <section key={key} className={styles.qa} data-reveal>
            <h2 className={styles.qaQ}>{t(`pages.faq.${key}.q`)}</h2>
            <p className={styles.qaA}>{renderLinkedText(t(`pages.faq.${key}.a`), links, styles.link)}</p>
          </section>
        ))}
      </div>

      <section className={styles.cta} data-reveal>
        <span className={styles.ctaRule} aria-hidden="true" />
        <h2 className={styles.ctaHeading}>{t('pages.faq.cta.heading')}</h2>
        <Link href="/board" className={styles.ctaLink}>
          {t('pages.faq.cta.button')}
          <span className={styles.ctaArrow} aria-hidden="true">↗</span>
        </Link>
      </section>
    </article>
  )
}
