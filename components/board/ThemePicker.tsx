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
}

/** THEMES section inside the SETTINGS drawer. One button per registered theme;
 *  free themes apply on click, paid+locked themes show a lock and (for now)
 *  do nothing destructive — the real unlock flow is a later session. */
export function ThemePicker({ themeId, onThemeChange }: ThemePickerProps): ReactElement {
  const { t } = useI18n()
  return (
    <div className={styles.section} data-testid="theme-picker">
      <div className={styles.heading}>THEMES</div>
      <div className={styles.grid}>
        {listThemeIds().map((id) => {
          const meta = getThemeMeta(id)
          const unlocked = isThemeUnlocked(meta, EMPTY_LICENSES)
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
              <span className={styles.badge}>{unlocked ? 'FREE' : 'LOCKED'}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
