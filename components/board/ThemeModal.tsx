'use client'

import { useEffect, useRef, type ReactElement } from 'react'
import type { ThemeId } from '@/lib/board/types'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { ThemePicker } from './ThemePicker'
import styles from './ThemeModal.module.css'

export interface ThemeModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly themeId: ThemeId
  readonly onThemeChange: (id: ThemeId) => void
}

/**
 * Dedicated full-screen theme picker. Rendered at the board root (like
 * {@link BookmarkletInstallModal}) so it escapes the SETTINGS drawer's
 * `overflow: hidden`, and so it sits close to board state for the live preview
 * that lands in Phase 2. The translucent backdrop keeps the real board faintly
 * visible behind, so a theme change reads immediately.
 *
 * Selecting a theme applies it but keeps the modal open — the user can try
 * several and watch the board update behind the dim before closing.
 */
export function ThemeModal({ isOpen, onClose, themeId, onThemeChange }: ThemeModalProps): ReactElement | null {
  const { t } = useI18n()
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isOpen) closeBtnRef.current?.focus()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      role="presentation"
      data-testid="theme-modal-overlay"
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-modal-title"
        onClick={(e): void => e.stopPropagation()}
        data-testid="theme-modal"
      >
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <h2 id="theme-modal-title" className={styles.title}>
              {t('board.theme.modalTitle')}
            </h2>
            <p className={styles.subtitle}>{t('board.theme.modalSubtitle')}</p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={t('board.theme.modalCloseLabel')}
            data-testid="theme-modal-close"
          >
            ×
          </button>
        </div>

        <div className={styles.body}>
          <ThemePicker
            themeId={themeId}
            onThemeChange={onThemeChange}
            variant="modal"
            showHeading={false}
          />
        </div>
      </div>
    </div>
  )
}
