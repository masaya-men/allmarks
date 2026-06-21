'use client'

import { type ReactElement } from 'react'
import { ChromeButton } from '../ChromeButton'
import styles from './TagButton.module.css'

export interface TagButtonProps {
  onClick: () => void
  active?: boolean
}

export function TagButton({ onClick, active }: TagButtonProps): ReactElement {
  return (
    <ChromeButton
      label="MANAGE TAGS"
      onClick={onClick}
      className={active ? styles.active : undefined}
      data-testid="tag-button"
      aria-pressed={active}
      data-onboarding-target="manage"
    />
  )
}
