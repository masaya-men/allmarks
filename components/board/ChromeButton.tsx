'use client'

import { type ReactElement } from 'react'
import { useChromeScramble } from '@/lib/board/use-idle-scramble'
import styles from './ChromeButton.module.css'

type Props = {
  readonly label: string
  readonly onClick: () => void
  readonly disabled?: boolean
  readonly className?: string
  readonly 'data-testid'?: string
  readonly 'aria-pressed'?: boolean
}

export function ChromeButton({
  label,
  onClick,
  disabled,
  className,
  'data-testid': dataTestId,
  'aria-pressed': ariaPressed,
}: Props): ReactElement {
  const { display, triggerBurst } = useChromeScramble(label)
  const cls = className ? `${styles.btn} ${className}` : styles.btn

  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      onMouseEnter={triggerBurst}
      disabled={disabled}
      data-testid={dataTestId}
      data-glitch-text={label}
      aria-pressed={ariaPressed}
    >
      {display}
    </button>
  )
}
