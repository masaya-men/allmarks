'use client'

import type { ReactElement, ReactNode } from 'react'
import styles from './BoardMobileNav.module.css'

/** Fixed bottom navigation for the mobile board (≤640px). Hosts the board's
 *  core controls — FILTER / TAG / THEME / MOTION / SETTINGS — since the desktop
 *  top-right action row and the MOTION+FilterPill top band are hidden on mobile
 *  (view-first, thumb-reachable). FILTER reuses the existing <FilterPill> (its
 *  menu opens UPWARD on mobile — see FilterPill.module.css); the other tabs are
 *  simple action buttons wired to the same handlers the desktop chrome uses.
 *  Rendered only when `useIsMobile()` is true, so desktop is untouched. */
export type BoardMobileNavProps = {
  /** The reused <FilterPill> node — its pill IS the FILTER tab. */
  readonly filter: ReactNode
  readonly onTag: () => void
  readonly tagActive: boolean
  readonly onThemes: () => void
  readonly themesActive: boolean
  readonly motionOn: boolean
  readonly onToggleMotion: () => void
  readonly onSettings: () => void
  readonly settingsActive: boolean
}

type IconProps = { readonly className?: string }

/** Minimal line glyphs (stroke = currentColor) matching the board's neutral
 *  chrome — no filled/branded SaaS icons. 22px viewbox, 1.6 stroke. */
function TagIcon({ className }: IconProps): ReactElement {
  return (
    <svg className={className} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3.5h7l8.5 8.5-6.5 6.5L3 10z" />
      <circle cx="7" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  )
}
function ThemeIcon({ className }: IconProps): ReactElement {
  return (
    <svg className={className} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="M11 3v16" />
      <path d="M11 3a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" />
    </svg>
  )
}
function MotionIcon({ className }: IconProps): ReactElement {
  return (
    <svg className={className} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 4.5l10 6.5-10 6.5z" />
    </svg>
  )
}
function SettingsIcon({ className }: IconProps): ReactElement {
  return (
    <svg className={className} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="2.6" />
      <path d="M11 2.5v2.4M11 17.1v2.4M2.5 11h2.4M17.1 11h2.4M4.9 4.9l1.7 1.7M15.4 15.4l1.7 1.7M17.1 4.9l-1.7 1.7M6.6 15.4l-1.7 1.7" />
    </svg>
  )
}

export function BoardMobileNav({
  filter,
  onTag,
  tagActive,
  onThemes,
  themesActive,
  motionOn,
  onToggleMotion,
  onSettings,
  settingsActive,
}: BoardMobileNavProps): ReactElement {
  return (
    <nav className={styles.nav} data-testid="board-mobile-nav" aria-label="Board controls">
      <div className={styles.filterSlot}>{filter}</div>
      <button
        type="button"
        className={styles.tab}
        data-active={tagActive ? 'true' : 'false'}
        onClick={onTag}
        data-testid="mobile-nav-tag"
      >
        <TagIcon className={styles.icon} />
        <span className={styles.tabLabel}>TAG</span>
      </button>
      <button
        type="button"
        className={styles.tab}
        data-active={themesActive ? 'true' : 'false'}
        onClick={onThemes}
        data-testid="mobile-nav-theme"
      >
        <ThemeIcon className={styles.icon} />
        <span className={styles.tabLabel}>THEME</span>
      </button>
      <button
        type="button"
        className={styles.tab}
        data-active={motionOn ? 'true' : 'false'}
        aria-pressed={motionOn}
        onClick={onToggleMotion}
        data-testid="mobile-nav-motion"
      >
        <MotionIcon className={styles.icon} />
        <span className={styles.tabLabel}>MOTION</span>
      </button>
      <button
        type="button"
        className={styles.tab}
        data-active={settingsActive ? 'true' : 'false'}
        onClick={onSettings}
        data-testid="mobile-nav-settings"
      >
        <SettingsIcon className={styles.icon} />
        <span className={styles.tabLabel}>MORE</span>
      </button>
    </nav>
  )
}
