'use client'

import { type ReactElement } from 'react'
import styles from './TuneTrigger.module.css'

type Props = {
  readonly widthPx: number
  readonly gapPx: number
  readonly onChangeWidth: (next: number) => void
  readonly onChangeGap: (next: number) => void
  readonly onReset: () => void
  readonly label?: string
}

export function TuneTrigger({
  widthPx: _widthPx,
  gapPx: _gapPx,
  onChangeWidth: _onChangeWidth,
  onChangeGap: _onChangeGap,
  onReset: _onReset,
  label,
}: Props): ReactElement {
  const visibleLabel = label ?? 'TUNE'
  return (
    <button
      type="button"
      data-testid="tune-trigger"
      className={styles.trigger}
      aria-haspopup="dialog"
      aria-expanded={false}
    >
      {visibleLabel}
    </button>
  )
}
