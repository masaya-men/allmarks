'use client'

import type { ReactElement } from 'react'
import type { ThemeId } from '@/lib/board/types'
import { listThemeIds, getThemeMeta, DEFAULT_THEME_ID } from '@/lib/board/theme-registry'
import { isThemeUnlocked, EMPTY_LICENSES } from '@/lib/board/theme-entitlement'
import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './ThemePicker.module.css'

export interface ThemePickerProps {
  readonly themeId: ThemeId
  readonly onThemeChange: (id: ThemeId) => void
  /** License set for paid themes. Defaults to the (currently empty) stub so
   *  callers need not pass it until real licenses exist; injectable for tests. */
  readonly licenses?: ReadonlySet<ThemeId>
  /** 'inline' = compact swatches (legacy drawer use); 'modal' = larger swatches
   *  for the dedicated theme screen. Defaults to 'inline'. */
  readonly variant?: 'inline' | 'modal'
  /** Show the internal "THEMES" heading. False when a host (the modal) already
   *  provides its own title. Defaults to true. */
  readonly showHeading?: boolean
}

/** Swatch grid of every registered theme. Free themes apply on click,
 *  paid+locked themes show a gentle lock and do nothing destructive — the real
 *  unlock flow is a later session. Used inside the dedicated theme modal
 *  (variant='modal'); the legacy inline drawer use kept the compact default. */
export function ThemePicker({
  themeId,
  onThemeChange,
  licenses = EMPTY_LICENSES,
  variant = 'inline',
  showHeading = true,
}: ThemePickerProps): ReactElement {
  const { t } = useI18n()
  return (
    <div className={styles.section} data-variant={variant} data-testid="theme-picker">
      {showHeading && <div className={styles.heading}>THEMES</div>}
      <div className={styles.grid} role="group" aria-label={t('board.theme.pickerGroupLabel')}>
        {listThemeIds().map((id) => {
          const meta = getThemeMeta(id)
          const unlocked = isThemeUnlocked(meta, licenses)
          const active = id === themeId
          return (
            <button
              key={id}
              type="button"
              className={styles.swatch}
              data-theme-button={id}
              data-testid={`theme-button-${id}`}
              data-scheme={meta.colorScheme}
              aria-pressed={active}
              disabled={!unlocked}
              onClick={(): void => {
                if (unlocked) onThemeChange(id)
              }}
            >
              <span className={styles.preview} data-theme-id={id} aria-hidden="true" />
              <span className={styles.name}>{t(meta.labelKey)}</span>
              {unlocked ? (
                <span className={styles.badge}>{id === DEFAULT_THEME_ID ? 'DEFAULT' : 'FREE'}</span>
              ) : (
                <span className={styles.lockedPill} data-locked-pill aria-hidden="false">
                  {t('board.theme.unlockLater')}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
