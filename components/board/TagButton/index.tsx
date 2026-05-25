'use client'

import { type ReactElement } from 'react'
import styles from './TagButton.module.css'

export interface TagButtonProps {
  onClick: () => void
  active?: boolean
}

export function TagButton({ onClick, active }: TagButtonProps): ReactElement {
  return (
    <button
      type="button"
      className={styles.button}
      data-active={active ? 'true' : 'false'}
      onClick={onClick}
      aria-label="Open tag management"
    >
      TAG
    </button>
  )
}
