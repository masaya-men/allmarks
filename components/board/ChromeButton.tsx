'use client'

import Link from 'next/link'
import { type ReactElement } from 'react'
import { useChromeScramble } from '@/lib/board/use-idle-scramble'
import { useIsPaperTheme } from '@/lib/board/use-is-paper-theme'
import styles from './ChromeButton.module.css'

type Props = {
  readonly label: string
  /** Click handler for the button variant. Ignored when `href` is set. */
  readonly onClick?: () => void
  /** When set, renders as a navigation link (Next <Link>) instead of a
   *  <button>, keeping the identical chrome treatment (monospace + scramble +
   *  RGB glitch). Used by the board wordmark → LP link so it matches the header
   *  menu exactly and themes with it. */
  readonly href?: string
  readonly disabled?: boolean
  readonly className?: string
  readonly 'data-testid'?: string
  readonly 'aria-pressed'?: boolean
  readonly 'aria-label'?: string
  readonly 'data-onboarding-target'?: string
}

export function ChromeButton({
  label,
  onClick,
  href,
  disabled,
  className,
  'data-testid': dataTestId,
  'aria-pressed': ariaPressed,
  'aria-label': ariaLabel,
  'data-onboarding-target': dataOnboardingTarget,
}: Props): ReactElement {
  const { display, triggerBurst } = useChromeScramble(label)
  const cls = className ? `${styles.btn} ${className}` : styles.btn

  // SSR-safe, live paper-theme flag (shared hook; tracks runtime theme switch).
  const paper = useIsPaperTheme()

  // On paper: render the static label (calm serif), skip the scramble burst.
  // On default: byte-identical to original behaviour.
  const content = paper ? label : display
  const onHover = paper ? undefined : triggerBurst

  if (href) {
    return (
      <Link
        href={href}
        className={cls}
        onMouseEnter={onHover}
        data-testid={dataTestId}
        data-glitch-text={label}
        aria-label={ariaLabel}
        data-onboarding-target={dataOnboardingTarget}
      >
        {content}
      </Link>
    )
  }

  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      onMouseEnter={onHover}
      disabled={disabled}
      data-testid={dataTestId}
      data-glitch-text={label}
      aria-pressed={ariaPressed}
      aria-label={ariaLabel}
      data-onboarding-target={dataOnboardingTarget}
    >
      {content}
    </button>
  )
}
