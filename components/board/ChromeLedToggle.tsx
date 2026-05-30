'use client'

import { type ReactElement } from 'react'
import { ChromeButton } from './ChromeButton'
import { StatusLed } from './StatusLed'
import styles from './ChromeLedToggle.module.css'

/** A chrome master-switch: dome LED + hairline divider + ChromeButton label
 *  (same glitch-hover as TUNE / POP OUT / SHARE). Reads as "● │ LABEL".
 *  Used for the board's on/off switches (background typography, etc.); MOTION
 *  keeps its own dedicated MotionToggle. */
export function ChromeLedToggle({
  on,
  onToggle,
  label,
  wrapTestId,
  ledTestId,
  btnTestId,
}: {
  readonly on: boolean
  readonly onToggle: () => void
  readonly label: string
  readonly wrapTestId?: string
  readonly ledTestId?: string
  readonly btnTestId?: string
}): ReactElement {
  return (
    <span className={styles.wrap} data-testid={wrapTestId}>
      <StatusLed on={on} data-testid={ledTestId} />
      <span className={styles.divider} aria-hidden="true" />
      <ChromeButton label={label} onClick={onToggle} className={styles.btn} data-testid={btnTestId} aria-pressed={on} />
    </span>
  )
}
