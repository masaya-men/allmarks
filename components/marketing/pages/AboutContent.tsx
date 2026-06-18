'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { useReveal } from '@/lib/scroll/use-reveal'
import styles from './AboutContent.module.css'

const GITHUB_URL = 'https://github.com/masaya-men/allmarks'

/**
 * About 本文 — LP grammar の編集的「about」ページ。
 *
 * 構成:
 *  - hero: mono kicker(緑ドット付き) + Fraunces 大見出し + soft lead。緑の短い rule で錨。
 *  - 三つの価値: 装飾的な serif 連番(01/02/03)を伴う heading/body の二段組み。
 *    ハイラインで区切る編集的シーケンス(カードグリッドではない)。
 *  - CTA: footer の黒 finale と競合しないよう、重い黒 pill ではなく
 *    緑 rule + 静かな下線 ghost link に。
 *
 * 文章は全て pages.about.* キーから(15言語キー整合のため新規コピー追加なし)。
 * 数字・rule・記号は装飾(翻訳対象外)。GitHub URL は allmarks リポ。
 *
 * 可視性はアニメ非依存: CSS 既定で全要素 opacity:1。useReveal は
 * matchMedia(1024px+ no-preference) gate 内のみで hidden 状態を所有し、
 * [data-reveal] の初期 opacity:0 は reduced-motion / mobile で打ち消す。
 */
export function AboutContent(): React.ReactElement {
  const { t } = useI18n()
  const rootRef = useRef<HTMLElement>(null)

  useReveal(rootRef as React.RefObject<HTMLElement>, { y: 24, stagger: 0.1 })

  return (
    <article ref={rootRef} className={styles.root}>
      <header className={styles.hero}>
        <p className={styles.kicker} data-reveal>
          <span className={styles.kickerDot} aria-hidden="true" />
          {t('pages.about.hero.kicker')}
        </p>
        <h1 className={styles.title} data-reveal>
          {t('pages.about.hero.title')}
        </h1>
        <p className={styles.lead} data-reveal>
          {t('pages.about.hero.lead')}
        </p>
      </header>

      <div className={styles.values}>
        <section className={styles.value} data-reveal>
          <div className={styles.valueIndex} aria-hidden="true">
            <span className={styles.valueNum}>01</span>
            <span className={styles.valueTick} />
          </div>
          <div className={styles.valueBody}>
            <h2 className={styles.heading}>{t('pages.about.philosophy.heading')}</h2>
            <p className={styles.body}>{t('pages.about.philosophy.body')}</p>
          </div>
        </section>

        <section className={styles.value} data-reveal>
          <div className={styles.valueIndex} aria-hidden="true">
            <span className={styles.valueNum}>02</span>
            <span className={styles.valueTick} />
          </div>
          <div className={styles.valueBody}>
            <h2 className={styles.heading}>{t('pages.about.privacy.heading')}</h2>
            <p className={styles.body}>{t('pages.about.privacy.body')}</p>
          </div>
        </section>

        <section className={styles.value} data-reveal>
          <div className={styles.valueIndex} aria-hidden="true">
            <span className={styles.valueNum}>03</span>
            <span className={styles.valueTick} />
          </div>
          <div className={styles.valueBody}>
            <h2 className={styles.heading}>{t('pages.about.openSource.heading')}</h2>
            <p className={styles.body}>
              {t('pages.about.openSource.body')}{' '}
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                GitHub
              </a>
            </p>
          </div>
        </section>
      </div>

      <section className={styles.cta} data-reveal>
        <span className={styles.ctaRule} aria-hidden="true" />
        <h2 className={styles.ctaHeading}>{t('pages.about.cta.heading')}</h2>
        <Link href="/board" className={styles.ctaLink}>
          {t('pages.about.cta.button')}
          <span className={styles.ctaArrow} aria-hidden="true">
            ↗
          </span>
        </Link>
      </section>
    </article>
  )
}
