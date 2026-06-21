// components/onboarding/BookmarkletInstallChip.tsx
'use client'

import { useEffect, useRef, type ReactElement } from 'react'
import { generateBookmarkletUri } from '@/lib/utils/bookmarklet'
import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './OnboardingController.module.css'

type Props = {
  readonly appUrl: string
  /** Fired when the user finishes dragging the chip (onDragEnd). The page can't
   *  see whether the drop actually landed on the browser's bookmark bar, so this
   *  is a GESTURE signal — the controller uses it to confirm + auto-advance. */
  readonly onDragComplete?: () => void
}

/** Thin-line bookmark glyph — mirrors the board chrome's stroke vocabulary. */
function BookmarkIcon({ className }: { readonly className?: string }): ReactElement {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 3.5 h12 a1 1 0 0 1 1 1 v16.2 a0.6 0.6 0 0 1 -0.93 0.5 L12 17.6 l-6.07 3.6 A0.6 0.6 0 0 1 5 20.7 V4.5 a1 1 0 0 1 1 -1 z" />
    </svg>
  )
}

/**
 * Draggable bookmarklet chip for the onboarding install scene. Lifted from
 * BookmarkletInstallModal's drag link: the href MUST be set via the DOM
 * (setAttribute) to bypass React 19's javascript: URL security block —
 * setting it in JSX silently strips the value.
 */
export function BookmarkletInstallChip({ appUrl, onDragComplete }: Props): ReactElement {
  const { t } = useI18n()
  const linkLabel = t('board.bookmarkletModal.linkLabel')
  const linkRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (linkRef.current) {
      linkRef.current.setAttribute('href', generateBookmarkletUri(appUrl))
    }
  }, [appUrl])

  return (
    <a
      ref={linkRef}
      data-testid="bookmarklet-drag-link"
      className={styles.installChip}
      draggable="true"
      onClick={(e) => e.preventDefault()}
      onDragEnd={() => onDragComplete?.()}
    >
      <BookmarkIcon className={styles.installChipIcon} />
      <span className={styles.installChipText}>{linkLabel}</span>
    </a>
  )
}
