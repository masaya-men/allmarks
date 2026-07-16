'use client'

import { type ReactElement, type RefObject } from 'react'
import styles from './QuietTrack.module.css'

/** Minimal editorial scroll indicator for the flat theme — just a hairline
 *  baseline and a bar handle. No ticks, no numbers (the parent hides the counter
 *  for this variant). Every child is pointer-events:none so the parent `.track`
 *  keeps the real scrub hit-area; only the marker is repositioned each frame by
 *  the parent rAF via `markerRef` (same contract as RulerTrack). */
type Props = {
  readonly markerRef: RefObject<HTMLDivElement | null>
}

export function QuietTrack({ markerRef }: Props): ReactElement {
  return (
    <div className={styles.rail} data-testid="quiet-track" aria-hidden="true">
      <div className={styles.baseline} />
      <div className={styles.markerTrack}>
        <div ref={markerRef} className={styles.marker} data-testid="quiet-marker" style={{ left: '0%' }} />
      </div>
    </div>
  )
}
