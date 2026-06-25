'use client'

import Link from 'next/link'
import { type ReactElement, useState, useEffect } from 'react'
import { useChromeScramble } from '@/lib/board/use-idle-scramble'
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

  // SSR-safe paper theme detection: read the DOM only after mount so the
  // initial server render and first client paint are identical (hydration-safe).
  // A MutationObserver keeps the flag in sync when the user switches themes at
  // runtime (BoardRoot updates data-theme-id without a page reload).
  const [paper, setPaper] = useState(false)
  useEffect(() => {
    const el = document.documentElement
    const read = (): void =>
      setPaper(el.getAttribute('data-theme-id') === 'paper-atelier')
    read()
    const obs = new MutationObserver(read)
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme-id'] })
    return () => obs.disconnect()
  }, [])

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
