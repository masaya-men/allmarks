'use client'

import { useRef } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { useReveal } from '@/lib/scroll/use-reveal'
import { DEMO_COLLAGE } from '@/lib/marketing/demo-collage'
import styles from './ShareIt.module.css'

/**
 * Asset indices from DEMO_COLLAGE used in the mini board thumbnail.
 * Hand-picked for shape variety: landscape + portrait + wide + near-square.
 * Grid-aligned, axis-aligned — NEVER rotated (hard AllMarks rule).
 */
const MINI_BOARD_ASSETS = [
  0,  // Hokusai wave (landscape)
  6,  // Renoir sisters (portrait)
  5,  // Monet stacks (wide)
  14, // Cézanne apples (near-square)
] as const

/**
 * ShareIt — the SHARE section of the AllMarks LP.
 *
 * Editorial narrative: your finished board travels as a single composed image
 * or a link. The visual is a framed mini-board — a clean 2×2 grid of artwork
 * thumbnails (CC0, no fabricated domains) presented as if it were an exported
 * PNG. Two quiet pill-hints ("export as image" / "copy link") sit below the
 * frame as suggestive affordances — not interactive widgets.
 *
 * Matches the LP grammar exactly: --lp-bg ground, Fraunces serif headline,
 * Geist body, --lp-ink-soft body text, --lp-accent used sparingly (accent
 * rule), generous whitespace, data-reveal / useReveal scroll animation.
 *
 * Hard rules honoured:
 * - ZERO tilt/rotation on any card or image (AllMarks is grid-based)
 * - No fabricated metadata (no fake domains, no made-up filenames shown)
 * - Vanilla CSS Modules only (no Tailwind)
 * - Static-export-safe <img> (no next/image dynamic sizing)
 */
export function ShareIt(): React.ReactElement {
  const { t } = useI18n()
  const sectionRef = useRef<HTMLElement>(null)

  useReveal(sectionRef as React.RefObject<HTMLElement>, { y: 24, stagger: 0.1 })

  return (
    <section ref={sectionRef} id="share" className={styles.share}>
      <div className={styles.stage}>

        {/* ── Section kicker ── */}
        <p className={styles.kicker} data-reveal>
          <span className={styles.kickerDash} aria-hidden="true" />
          SHARE
        </p>

        <div className={styles.split}>
          {/* ── Text column ── */}
          <div className={styles.text}>
            {/* Accent rule — a short green line above the headline */}
            <span className={styles.rule} aria-hidden="true" data-reveal />

            <h2 className={styles.headline} data-reveal>
              {t('landing.share.headline')}
            </h2>

            <p className={styles.body} data-reveal>
              {t('landing.share.body')}
            </p>

            {/* Quiet pill hints — suggestive affordances, not functional widgets */}
            <div className={styles.hints} data-reveal aria-hidden="true">
              <span className={styles.hint}>
                <span className={styles.hintIcon} aria-hidden="true">
                  {/* Download / image glyph */}
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M8 2v8m0 0-3-3m3 3 3-3M2 12h12"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                export as image
              </span>
              <span className={styles.hint}>
                <span className={styles.hintIcon} aria-hidden="true">
                  {/* Link / share glyph */}
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M6 8a2 2 0 0 0 2 2h.5a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 0-2.5 1"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M10 8a2 2 0 0 0-2-2H7.5a3.5 3.5 0 0 0 0 7H8a3.5 3.5 0 0 0 2.5-1"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                copy link
              </span>
            </div>
          </div>

          {/* ── Visual column: framed mini-board ── */}
          <div className={styles.visual} data-reveal>
            {/*
              The "exported image" frame. It reads as a finished board
              captured as a picture — suggested by the photograph-style
              border chrome (soft shadow, fine inset rule, cream mat).
              The grid inside is a genuine 2×2 of CC0 art thumbnails,
              perfectly axis-aligned (no rotation, per AllMarks rules).
            */}
            <figure className={styles.frame} aria-hidden="true">
              {/* Mat / inset layer — suggests photo print */}
              <div className={styles.mat}>
                <div className={styles.miniBoard}>
                  {MINI_BOARD_ASSETS.map((assetIdx, i) => {
                    const art = DEMO_COLLAGE[assetIdx]
                    if (!art) return null
                    return (
                      <div key={i} className={styles.miniCard}>
                        <img
                          src={`/${art.src}`}
                          alt=""
                          width={art.w}
                          height={art.h}
                          className={styles.miniCardImg}
                          loading="lazy"
                          decoding="async"
                          draggable={false}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Bottom strip — subtle "AllMarks" watermark row, like a photo credit */}
              <div className={styles.frameStrip} aria-hidden="true">
                <span className={styles.frameWordmark}>AllMarks</span>
                <span className={styles.frameDot} />
                <span className={styles.frameHint}>your board</span>
              </div>
            </figure>
          </div>
        </div>
      </div>
    </section>
  )
}
