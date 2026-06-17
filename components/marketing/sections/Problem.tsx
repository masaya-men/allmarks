'use client'

import { useRef } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { useReveal } from '@/lib/scroll/use-reveal'
import styles from './Problem.module.css'

/**
 * Problem section — the quiet "pause / turn" beat between Hero and Features.
 *
 * A text-forward, editorially confident statement that names the friction the
 * user already feels. No imagery needed. One small accent mark (the green dash
 * rule) is the only colour. Generous whitespace, large Fraunces serif headline,
 * soft body copy. Grid-aligned, axis-aligned — NO tilt, NO rotation.
 *
 * Reveal: both the headline and body carry `data-reveal` so useReveal() fades
 * them in with a gentle stagger when they enter the viewport.
 */
export function Problem(): React.ReactElement {
  const { t } = useI18n()
  const sectionRef = useRef<HTMLElement>(null)

  useReveal(sectionRef as React.RefObject<HTMLElement>, { y: 22, stagger: 0.11 })

  return (
    <section ref={sectionRef} id="problem" className={styles.problem}>
      <div className={styles.stage}>
        {/* Accent rule — a single green dash that anchors the editorial column */}
        <span className={styles.rule} aria-hidden="true" data-reveal />

        <h2 className={styles.headline} data-reveal>
          {t('landing.problem.headline')}
        </h2>

        <p className={styles.body} data-reveal>
          {t('landing.problem.body')}
        </p>
      </div>
    </section>
  )
}
