'use client'

import { useEffect, useRef } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { useReveal } from '@/lib/scroll/use-reveal'
import { DEMO_COLLAGE } from '@/lib/marketing/demo-collage'
import styles from './ShareIt.module.css'

/**
 * Per-tile scatter offsets for the board-assembly reveal.
 * Each tile starts displaced away from the frame centre, then converges.
 * Order matches MINI_BOARD_ASSETS (top-left, top-right, bottom-left, bottom-right).
 * x/y are in px; kept moderate so the motion reads clearly without being jarring.
 */
const TILE_SCATTER: ReadonlyArray<{ x: number; y: number }> = [
  { x: -48, y: -40 }, // top-left  → comes from upper-left
  { x:  48, y: -40 }, // top-right → comes from upper-right
  { x: -48, y:  40 }, // bottom-left  → comes from lower-left
  { x:  48, y:  40 }, // bottom-right → comes from lower-right
] as const

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
  const frameRef = useRef<HTMLElement>(null)

  // useReveal handles: kicker, rule, headline, body, hints, visual.
  // NOTE: .visual no longer carries data-reveal — the board-assembly animation
  // below owns the visual column entirely (fade-in the frame, then assemble tiles).
  useReveal(sectionRef as React.RefObject<HTMLElement>, { y: 24, stagger: 0.1 })

  useEffect((): (() => void) => {
    const section = sectionRef.current
    const frame = frameRef.current
    if (!section || !frame) return (): void => undefined

    let ctx: gsap.MatchMedia | undefined
    let cancelled = false

    const loadGsap = async (): Promise<void> => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ])
      // Unmounted during the dynamic import — don't create a matchMedia the
      // cleanup (which already ran) can't revert, or it leaks (rank44).
      if (cancelled) return
      gsap.registerPlugin(ScrollTrigger)

      const tiles = Array.from(frame.querySelectorAll<HTMLElement>('[data-share-tile]'))
      const mark = frame.querySelector<HTMLElement>('[data-share-mark]')

      if (tiles.length === 0) return

      ctx = gsap.matchMedia()
      ctx.add(
        '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
        (): (() => void) => {
          // Set initial hidden/scattered state ONLY inside this block.
          // Default CSS keeps everything visible for SSR, mobile, reduced-motion.
          tiles.forEach((tile, i): void => {
            const scatter = TILE_SCATTER[i] ?? { x: 0, y: 0 }
            gsap.set(tile, { x: scatter.x, y: scatter.y, scale: 0.85, opacity: 0 })
          })
          if (mark) gsap.set(mark, { opacity: 0 })

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: section,
              start: 'top 70%',
              once: true,
            },
          })

          tl.to(tiles, {
            x: 0,
            y: 0,
            scale: 1,
            opacity: 1,
            duration: 0.7,
            stagger: 0.09,
            ease: 'power3.out',
            onComplete: (): void => {
              tiles.forEach((tile): void => {
                gsap.set(tile, { clearProps: 'x,y,scale,opacity' })
              })
            },
          })

          if (mark) {
            tl.to(
              mark,
              {
                opacity: 1,
                duration: 0.5,
                ease: 'power2.out',
                onComplete: (): void => {
                  gsap.set(mark, { clearProps: 'opacity' })
                },
              },
              '-=0.15',
            )
          }

          return (): void => {
            tl.scrollTrigger?.kill()
            tl.kill()
          }
        },
      )
    }

    void loadGsap()

    return (): void => {
      cancelled = true
      ctx?.revert()
    }
  }, [])

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
          {/*
            NOTE: data-reveal intentionally REMOVED here.
            The board-assembly animation (useEffect above) owns the visual
            column. data-reveal on this element would cause a double-animation
            (useReveal opacity-fade AND assembly reveal fighting each other).
            The frame fades in as part of the parent section's reveal via the
            assembly timeline instead.
          */}
          <div className={styles.visual}>
            {/*
              The "exported image" frame. It reads as a finished board
              captured as a picture — suggested by the photograph-style
              border chrome (soft shadow, fine inset rule, cream mat).
              The grid inside is a genuine 2×2 of CC0 art thumbnails,
              perfectly axis-aligned (no rotation, per AllMarks rules).
            */}
            <figure ref={frameRef} className={styles.frame} aria-hidden="true">
              {/* Mat / inset layer — suggests photo print */}
              <div className={styles.mat}>
                <div className={styles.miniBoard}>
                  {MINI_BOARD_ASSETS.map((assetIdx, i) => {
                    const art = DEMO_COLLAGE[assetIdx]
                    if (!art) return null
                    return (
                      <div key={i} className={styles.miniCard} data-share-tile>
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
              <div className={styles.frameStrip} aria-hidden="true" data-share-mark>
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
