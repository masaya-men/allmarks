'use client'
import { type ReactElement, type ReactNode } from 'react'
import styles from './BlockedChrome.module.css'

/** Wraps a board chrome control so it stays VISIBLE (identical look) but is
 *  struck through and inert — signals "same board, but a receiver view".
 *  Blocks pointer + keyboard by disabling hit testing on the children. */
export function BlockedChrome({
  children,
  label,
}: {
  readonly children: ReactNode
  /** For aria + tooltip; the visible label still comes from children. */
  readonly label?: string
}): ReactElement {
  return (
    <span
      className={styles.wrap}
      data-testid="blocked-chrome"
      aria-disabled="true"
      title={label ? `${label} (not available on a shared view)` : undefined}
    >
      {children}
      <span className={styles.strike} aria-hidden="true" />
    </span>
  )
}
