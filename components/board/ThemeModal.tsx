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
 * Theme picker — a right-docked, NON-blocking panel (not a dim modal). The
 * board stays fully visible and interactive behind it, so clicking a theme
 * re-themes the real board live (that IS the preview — no separate replica).
 *
 * Rendered at the board root (like {@link BookmarkletInstallModal}) so it
 * escapes the SETTINGS drawer's stacking context. The overlay is
 * pointer-events:none (board keeps panning/scrolling); only the panel itself
 * is interactive. Dismissed via × or Esc.
 *
 * Themes are grouped into PATTERN (customizable — Sound Wave, Grid; the
 * customize controls land in Phase 3) and WORKS (fixed crafted worlds — Paper).
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
    <div className={styles.overlay} role="presentation" data-testid="theme-modal-overlay">
      <aside
        className={styles.panel}
        role="dialog"
        aria-labelledby="theme-modal-title"
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
          <section className={styles.group}>
            <div className={styles.groupLabel}>PATTERN THEMES</div>
            <ThemePicker
              themeId={themeId}
              onThemeChange={onThemeChange}
              variant="modal"
              showHeading={false}
              filterKind="pattern"
            />
          </section>

          <section className={styles.group}>
            <div className={styles.groupLabel}>WORKS</div>
            <ThemePicker
              themeId={themeId}
              onThemeChange={onThemeChange}
              variant="modal"
              showHeading={false}
              filterKind="work"
            />
          </section>
          {/* Phase 3: a CUSTOMIZE section (edge / board / pattern colour +
              pattern type) mounts here when a pattern theme is active. */}
        </div>
      </aside>
    </div>
  )
}
