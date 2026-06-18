'use client'

import { useEffect, useRef } from 'react'
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
 * Reveal:
 *  - headline: clip-path horizontal wipe (left→right) via ScrollTrigger,
 *    PC + no-preference only (gsap.matchMedia). Default CSS keeps it visible
 *    so SSR / reduced-motion / mobile never shows a clipped headline.
 *  - rule + body: useReveal() opacity/y fade (unchanged).
 */
export function Problem(): React.ReactElement {
  const { t } = useI18n()
  const sectionRef = useRef<HTMLElement>(null)
  const headlineRef = useRef<HTMLHeadingElement>(null)

  // Headline is NOT in data-reveal; wipe animation owns it instead.
  useReveal(sectionRef as React.RefObject<HTMLElement>, { y: 22, stagger: 0.11 })

  useEffect((): (() => void) => {
    const headline = headlineRef.current
    if (!headline) return (): void => undefined

    let ctx: gsap.MatchMedia | undefined

    const loadGsap = async (): Promise<void> => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ])
      gsap.registerPlugin(ScrollTrigger)

      ctx = gsap.matchMedia()
      ctx.add(
        '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
        () => {
          // Set initial hidden state only inside this media query block.
          gsap.set(headline, { clipPath: 'inset(0 100% 0 0)' })

          gsap.to(headline, {
            clipPath: 'inset(0 0% 0 0)',
            duration: 0.9,
            ease: 'power3.inOut',
            scrollTrigger: {
              trigger: headline,
              start: 'top 75%',
              once: true,
            },
            onComplete: (): void => {
              // Remove inline clip-path so CSS cascade takes over cleanly.
              gsap.set(headline, { clearProps: 'clipPath' })
            },
          })
        },
      )
    }

    void loadGsap()

    return (): void => {
      ctx?.revert()
    }
  }, [])

  return (
    <section ref={sectionRef} id="problem" className={styles.problem}>
      <div className={styles.stage}>
        {/* Accent rule — a single green dash that anchors the editorial column */}
        <span className={styles.rule} aria-hidden="true" data-reveal />

        {/* headline: clip-wipe owns this; NO data-reveal to avoid double animation */}
        <h2 ref={headlineRef} className={styles.headline}>
          {t('landing.problem.headline')}
        </h2>

        <p className={styles.body} data-reveal>
          {t('landing.problem.body')}
        </p>
      </div>
    </section>
  )
}
