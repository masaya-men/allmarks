'use client'

import { useMemo, type ReactElement, type RefObject } from 'react'
import styles from './QuietTrack.module.css'

/** Sparse ruler for the flat theme — an editorial "quiet line": a hairline
 *  baseline, a few faint ticks, and a simple bar marker. No paper assets, no
 *  scramble. Every child is pointer-events:none so the parent `.track` keeps
 *  the real scrub hit-area; only the marker is repositioned each frame by the
 *  parent rAF via `markerRef` (same contract as RulerTrack). */
const UNITS = 100
const STEP = 10

type Props = {
  readonly markerRef: RefObject<HTMLDivElement | null>
}

export function QuietTrack({ markerRef }: Props): ReactElement {
  const ticks = useMemo(
    () => Array.from({ length: UNITS / STEP + 1 }, (_, i) => i * STEP),
    [],
  )
  return (
    <div className={styles.rail} data-testid="quiet-track" aria-hidden="true">
      <div className={styles.baseline} />
      {ticks.map((u) => (
        <div key={u} className={styles.tick} style={{ left: `${u}%` }} />
      ))}
      <div className={styles.markerTrack}>
        <div ref={markerRef} className={styles.marker} data-testid="quiet-marker" style={{ left: '0%' }} />
      </div>
    </div>
  )
}
