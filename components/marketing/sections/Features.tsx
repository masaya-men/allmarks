'use client'

import { useRef } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { useReveal } from '@/lib/scroll/use-reveal'
import { DEMO_COLLAGE, DEMO_VIDEOS } from '@/lib/marketing/demo-collage'
import styles from './Features.module.css'

/**
 * One image card shown inside a beat visual. The artwork IS the card — clean,
 * label-free, axis-aligned, exactly matching the real board's ImageCard (which
 * renders only the image, no domain/host strip, no favicon). NEVER rotated.
 */
type VisualCard = {
  /** Index into DEMO_COLLAGE for the thumbnail. */
  readonly asset: number
  /** When true, draw a play-triangle overlay so the card reads as "video".
   *  This is an honest TYPE signal via shape, never a fabricated domain. */
  readonly video?: boolean
}

/**
 * A single feature "beat" in the 01–05 editorial sequence. The number + English
 * label kicker are HARDCODED here (intentionally not translated) — they are the
 * sequence's spine. The title/body are i18n keys under `landing.features.<key>`.
 */
type Beat = {
  /** Two-digit sequence number, e.g. "01". */
  readonly num: string
  /** English label kicker, e.g. "CAPTURE". Hardcoded, not translated. */
  readonly label: string
  /** i18n sub-key under landing.features (capture|layout|live|organize|privacy). */
  readonly key: string
  /** Which supporting visual to render in the visual slot. */
  readonly visual: 'capture' | 'layout' | 'live' | 'organize' | 'privacy'
}

/**
 * The five beats, in order. Numbers + labels are the hardcoded spine of the
 * sequence; titles/bodies come from i18n.
 */
const BEATS: readonly Beat[] = [
  { num: '01', label: 'CAPTURE', key: 'capture', visual: 'capture' },
  { num: '02', label: 'LAYOUT', key: 'layout', visual: 'layout' },
  { num: '03', label: 'LIVE GRID', key: 'live', visual: 'live' },
  { num: '04', label: 'ORGANIZE', key: 'organize', visual: 'organize' },
  { num: '05', label: 'PRIVACY', key: 'privacy', visual: 'privacy' },
] as const

/** 01 CAPTURE — a few clean cards of DIFFERENT shapes (wide / tall / square)
 *  plus ONE card flagged as video (play-triangle overlay, no domain text).
 *  "Variety of sources" is carried by shape + the copy, never fake labels. */
const CAPTURE_CARDS: readonly VisualCard[] = [
  { asset: 5 }, // Monet stacks — wide landscape
  { asset: 3, video: true }, // Van Gogh self-portrait — tall, marked as video
  { asset: 14 }, // Cézanne apples — near-square
] as const

/** 02 LAYOUT — a clean masonry like the real AllMarks board. Mixed formats so
 *  the columns balance; clean image cards only, no labels. */
const LAYOUT_CARDS: readonly VisualCard[] = [
  { asset: 0 }, // Hokusai wave (landscape)
  { asset: 6 }, // Renoir sisters (portrait)
  { asset: 9 }, // Caillebotte Paris street
  { asset: 8 }, // Moulin Rouge
  { asset: 12 }, // Tiffany lilies (tall thin)
  { asset: 1 }, // Hiroshige Tokaido (landscape)
] as const

/** 04 ORGANIZE — theme-agnostic swatches. Neutral inks + one green accent so
 *  no single theme is branded. Paired with a few text tag pills. */
const THEME_SWATCHES: readonly string[] = [
  '#14130f',
  '#faf9f6',
  '#28f100',
  '#9a958a',
  '#3b3a35',
] as const

/** 04 ORGANIZE — example tag chips. Plain, lowercase, neutral text. */
const TAG_PILLS: readonly string[] = ['inspo', 'video', 'shop', 'read'] as const

/** 05 PRIVACY — short typographic reassurance rows. */
const PRIVACY_ROWS: readonly string[] = [
  'No account',
  'Stored locally',
  'Always free',
] as const

/**
 * Renders the supporting visual for a given beat. All cards are clean image
 * thumbnails (no labels, no fabricated domains) and strictly axis-aligned.
 */
function BeatVisual({ visual }: { visual: Beat['visual'] }): React.ReactElement {
  if (visual === 'capture') {
    return (
      <div className={styles.captureRow}>
        {CAPTURE_CARDS.map((card, i) => {
          const art = DEMO_COLLAGE[card.asset]
          if (!art) return null
          return (
            <figure key={i} className={styles.card}>
              <img
                src={`/${art.src}`}
                alt=""
                width={art.w}
                height={art.h}
                className={styles.cardImg}
                loading="lazy"
                decoding="async"
                draggable={false}
              />
              {card.video ? (
                <span className={styles.playBadge} aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path d="M8 5v14l11-7z" fill="currentColor" />
                  </svg>
                </span>
              ) : null}
            </figure>
          )
        })}
      </div>
    )
  }

  if (visual === 'layout') {
    return (
      <div className={styles.masonry}>
        {LAYOUT_CARDS.map((card, i) => {
          const art = DEMO_COLLAGE[card.asset]
          if (!art) return null
          return (
            <figure key={i} className={styles.card}>
              <img
                src={`/${art.src}`}
                alt=""
                width={art.w}
                height={art.h}
                className={styles.cardImg}
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            </figure>
          )
        })}
      </div>
    )
  }

  if (visual === 'live') {
    // POSTER PLACEHOLDER. A later task (Task 8) swaps this static poster for
    // real autoplaying video — keyed off the data-livegrid-slot marker below.
    const vid = DEMO_VIDEOS[0]
    return (
      <div className={styles.liveSlot} data-livegrid-slot>
        {vid ? (
          <figure className={styles.card}>
            <img
              src={`/${vid.poster}`}
              alt=""
              width={vid.w}
              height={vid.h}
              className={styles.cardImg}
              loading="lazy"
              decoding="async"
              draggable={false}
            />
            <span className={styles.playBadge} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
            </span>
          </figure>
        ) : null}
      </div>
    )
  }

  if (visual === 'organize') {
    return (
      <div className={styles.organize}>
        <div className={styles.pillRow} aria-hidden="true">
          {TAG_PILLS.map((tag) => (
            <span key={tag} className={styles.pill}>
              <span className={styles.pillHash}>#</span>
              {tag}
            </span>
          ))}
        </div>
        <div className={styles.swatchRow} aria-hidden="true">
          {THEME_SWATCHES.map((c, i) => (
            <span
              key={i}
              className={styles.swatch}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
    )
  }

  // privacy — quiet typographic rows, minimal visual
  return (
    <ul className={styles.privacyList} aria-hidden="true">
      {PRIVACY_ROWS.map((row) => (
        <li key={row} className={styles.privacyRow}>
          <span className={styles.privacyDot} />
          {row}
        </li>
      ))}
    </ul>
  )
}

/**
 * Features — the FEATURES section of the LP, as a numbered editorial sequence
 * (01–05), NOT a boxed SaaS grid.
 *
 * Five full-width "beats" stack vertically, each a two-column editorial moment:
 * a mono number + English label kicker (the sequence spine), a Fraunces serif
 * title and Geist body (from i18n), paired with a bold, grid-aligned supporting
 * visual built from real CC0 demo assets. Beats alternate text-left / visual-
 * right for rhythm and stack cleanly to a single column at narrow widths.
 *
 * Hard rules honored: every card/image is AXIS-ALIGNED (never tilted), and NO
 * fabricated source domains/favicons appear anywhere — source variety is shown
 * through card shape/type (e.g. a play-triangle = video) and through the copy.
 *
 * The 03 LIVE GRID visual is a static poster placeholder marked with
 * `data-livegrid-slot` so Task 8 can swap in real autoplaying video.
 */
export function Features(): React.ReactElement {
  const { t } = useI18n()
  const sectionRef = useRef<HTMLElement>(null)

  useReveal(sectionRef as React.RefObject<HTMLElement>, { y: 26, stagger: 0.08 })

  return (
    <section ref={sectionRef} id="features" className={styles.features}>
      <div className={styles.stage}>
        <p className={styles.kicker} data-reveal>
          <span className={styles.kickerDash} aria-hidden="true" />
          FEATURES
        </p>

        <div className={styles.sequence}>
          {BEATS.map((beat) => (
            <article key={beat.num} className={styles.beat} data-reveal>
              <div className={styles.beatText}>
                <p className={styles.beatNum}>
                  <span className={styles.num}>{beat.num}</span>
                  <span className={styles.numLabel}>{beat.label}</span>
                </p>
                <h3 className={styles.beatTitle}>
                  {t(`landing.features.${beat.key}.title`)}
                </h3>
                <p className={styles.beatBody}>
                  {t(`landing.features.${beat.key}.body`)}
                </p>
              </div>

              <div className={styles.beatVisual}>
                <BeatVisual visual={beat.visual} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
