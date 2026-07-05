'use client'

import type { ReactElement } from 'react'
import type { ThemeId, ThemeCustomization } from '@/lib/board/types'
import { type ResolvedThemeCustomization, themeAllowsPattern } from '@/lib/board/theme-customization'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { ChromeDrawer } from './ChromeDrawer'
import { ThemePicker } from './ThemePicker'
import { ThemeCustomizeSection } from './ThemeCustomizeSection'
import styles from './ThemeModal.module.css'

export interface ThemeModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly themeId: ThemeId
  readonly onThemeChange: (id: ThemeId) => void
  /** Effective customization for the active theme, or null for fixed 'work'
   *  themes (then the CUSTOMIZE section is hidden). */
  readonly customization: ResolvedThemeCustomization | null
  /** True when the active theme sits at its byte-identical default. */
  readonly isDefaultCustomization: boolean
  /** Apply a customization patch live; null = reset the theme to defaults. */
  readonly onCustomize: (patch: ThemeCustomization | null) => void
}

/**
 * Theme picker — a right-docked, NON-blocking panel (not a dim modal). The
 * board stays fully visible and interactive behind it, so clicking a theme
 * re-themes the real board live (that IS the preview — no separate replica).
 *
 * Rendered at the board root (like {@link BookmarkletInstallModal}) so it
 * escapes the SETTINGS drawer's stacking context. Esc / outside-click /
 * focus / scroll-fade / overlay+panel chrome are all provided by
 * {@link ChromeDrawer} (the shared right-drawer primitive); this component
 * only supplies the title and the theme-picking content.
 *
 * Themes are grouped into PATTERN (customizable — Sound Wave, Grid; the
 * customize controls land in Phase 3) and WORKS (fixed crafted worlds — Paper).
 */
export function ThemeModal({
  isOpen,
  onClose,
  themeId,
  onThemeChange,
  customization,
  isDefaultCustomization,
  onCustomize,
}: ThemeModalProps): ReactElement | null {
  const { t } = useI18n()

  return (
    <ChromeDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('board.theme.modalTitle')}
      testId="theme-modal"
      closeLabel={t('board.theme.modalCloseLabel')}
    >
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
      {/* CUSTOMIZE — only for 'pattern' themes (customization non-null). */}
      {customization && (
        <ThemeCustomizeSection
          value={customization}
          isDefault={isDefaultCustomization}
          allowsPattern={themeAllowsPattern(themeId)}
          onChange={onCustomize}
        />
      )}
    </ChromeDrawer>
  )
}
