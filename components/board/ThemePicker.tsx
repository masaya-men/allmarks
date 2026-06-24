'use client'

import type { ReactElement } from 'react'
import type { ThemeId } from '@/lib/board/types'
import { listThemeIds, getThemeMeta } from '@/lib/board/theme-registry'
import { isThemeUnlocked, EMPTY_LICENSES } from '@/lib/board/theme-entitlement'
import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './ThemePicker.module.css'

export interface ThemePickerProps {
  readonly themeId: ThemeId
  readonly onThemeChange: (id: ThemeId) => void
  /** License set for paid themes. Defaults to the (currently empty) stub so
   *  callers need not pass it until real licenses exist; injectable for tests. */
  readonly licenses?: ReadonlySet<ThemeId>
}

/** THEMES section inside the SETTINGS drawer. One button per registered theme;
 *  free themes apply on click, paid+locked themes show a lock and (for now)
 *  do nothing destructive — the real unlock flow is a later session. */
export function ThemePicker({ themeId, onThemeChange, licenses = EMPTY_LICENSES }: ThemePickerProps): ReactElement {
  const { t } = useI18n()
  return (
    <div className={styles.section} data-testid="theme-picker">
      <div className={styles.heading}>THEMES</div>
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
                <span className={styles.badge}>FREE</span>
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
