'use client'

import { useMemo, type ReactElement, type RefObject } from 'react'
import styles from './RulerTrack.module.css'

/** Number of ruler units shown across the full track width (0..100, a
 *  percentage scale — the meter is a fraction-of-content readout, not a
 *  count). Major ticks every 10, minor ticks every 2. Decoupled from the
 *  waveform's TICK_COUNT (150): the ruler is a tape-measure, not 150 lines. */
const RULER_UNITS = 100
const MAJOR_STEP = 10
const MINOR_STEP = 2

type Props = {
  /** Forwarded ref to the brass marker triangle. The parent ScrollMeter rAF
   *  loop sets `marker.style.left = '<pct>%'` each frame from centerTickIdx,
   *  so RulerTrack itself stays static (no per-frame React renders). */
  readonly markerRef: RefObject<HTMLDivElement | null>
}

/**
 * Static tape-measure ruler for the paper-atelier theme. Renders major /
 * minor ruler ticks with Geist-Mono numerals and a brass marker. Purely
 * decorative — every child is pointer-events:none so the parent `.track`
 * keeps the real scrub hit-area. The only animated element is the marker,
 * positioned by the parent rAF via `markerRef`.
 */
export function RulerTrack({ markerRef }: Props): ReactElement {
  // Precompute tick positions once. Major when divisible by MAJOR_STEP,
  // otherwise minor when divisible by MINOR_STEP.
  const ticks = useMemo(
    () =>
      Array.from({ length: RULER_UNITS / MINOR_STEP + 1 }, (_, idx) => {
        const unit = idx * MINOR_STEP
        return { unit, isMajor: unit % MAJOR_STEP === 0 }
      }),
    [],
  )

  return (
    <div className={styles.rail} data-testid="ruler-track" aria-hidden="true">
      <div className={styles.rule} />
      {ticks.map(({ unit, isMajor }) => {
        const leftPct = (unit / RULER_UNITS) * 100
        return isMajor ? (
          <div key={unit}>
            <span
              className={styles.numeral}
              data-testid="ruler-numeral"
              style={{ left: `${leftPct}%` }}
            >
              {unit}
            </span>
            <div className={styles.majorTick} style={{ left: `${leftPct}%` }} />
          </div>
        ) : (
          <div
            key={unit}
            className={styles.minorTick}
            style={{ left: `${leftPct}%` }}
          />
        )
      })}
      <div
        ref={markerRef}
        className={styles.marker}
        data-testid="ruler-marker"
        style={{ left: '0%', pointerEvents: 'none' }}
      />
    </div>
  )
}
