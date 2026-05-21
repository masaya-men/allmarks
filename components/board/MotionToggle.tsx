'use client'

import { type ReactElement } from 'react'
import { ChromeButton } from './ChromeButton'
import { StatusLed } from './StatusLed'
import styles from './MotionToggle.module.css'

/** MOTION master switch: plain ChromeButton text (no box, same glitch hover as
 *  TUNE/POP OUT/SHARE) + a reused dome LED showing on/off. */
export function MotionToggle({
  enabled,
  onToggle,
}: {
  readonly enabled: boolean
  readonly onToggle: () => void
}): ReactElement {
  return (
    <span className={styles.wrap} data-testid="motion-toggle-wrap">
      <StatusLed on={enabled} data-testid="motion-led" />
      <span className={styles.divider} aria-hidden="true" />
      <ChromeButton label="MOTION" onClick={onToggle} data-testid="motion-toggle" aria-pressed={enabled} />
    </span>
  )
}
