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

/** Vertical list of every registered theme — one row per theme, name only.
 *  The theme drawer is non-blocking and the board stays visible behind it, so
 *  clicking a name re-themes the real board live: the board IS the preview, and
 *  no swatch art is needed (that's why the old preview squares were dropped).
 *  Free themes apply on click; paid+locked themes show a gentle amber "unlock
 *  later" pill and do nothing destructive — the real unlock flow is later. */
export function ThemePicker({
  themeId,
  onThemeChange,
  licenses = EMPTY_LICENSES,
}: ThemePickerProps): ReactElement {
  const { t } = useI18n()
  const ids = listThemeIds()
  return (
    <div className={styles.section} data-testid="theme-picker">
      <div className={styles.list} role="group" aria-label={t('board.theme.pickerGroupLabel')}>
        {ids.map((id) => {
          const meta = getThemeMeta(id)
          const unlocked = isThemeUnlocked(meta, licenses)
          const active = id === themeId
          return (
            <button
              key={id}
              type="button"
              className={styles.row}
              data-theme-button={id}
              data-testid={`theme-button-${id}`}
              data-scheme={meta.colorScheme}
              aria-pressed={active}
              disabled={!unlocked}
              onClick={(): void => {
                if (unlocked) onThemeChange(id)
              }}
            >
              <span className={styles.check} aria-hidden="true">{active ? '✓' : ''}</span>
              <span className={styles.name}>{t(meta.labelKey)}</span>
              {!unlocked && (
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
