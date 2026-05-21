import { type ReactElement } from 'react'
import styles from './StatusLed.module.css'

/** Domed status lamp reused from the TUNE drawer LED recipe (radial-gradient
 *  reflection + edge darkening). `on` toggles lit-green vs unlit-dim. */
export function StatusLed({
  on,
  'data-testid': dataTestId,
}: {
  readonly on: boolean
  readonly 'data-testid'?: string
}): ReactElement {
  return <span className={styles.led} data-on={on ? 'true' : 'false'} data-testid={dataTestId} aria-hidden="true" />
}
