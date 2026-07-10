'use client'

import type { ReactElement } from 'react'
import styles from './BoardMobileNav.module.css'

/** Fixed bottom navigation for the mobile board (≤640px). Hosts TAG / THEME /
 *  SHARE / CORNERS / MORE. FILTER lives in the top-right header (opposite the
 *  AllMarks wordmark) — not here — so the two chrome anchors bracket the top of
 *  the board. Wired to the same handlers the desktop chrome uses. Rendered only
 *  when `useIsMobile()` is true, so desktop is untouched. */
export type BoardMobileNavProps = {
  readonly onTag: () => void
  readonly tagActive: boolean
  readonly onThemes: () => void
  readonly themesActive: boolean
  /** Enter SHARE select mode (BoardRoot's handleEnterSelectMode). No active
   *  state: the nav unmounts while a share stage is running. */
  readonly onShare: () => void
  /** Card corner style — true = rounded, false = square (TUNE → CORNERS on
   *  desktop). Exposed here so mobile can toggle it too (no TUNE drawer). */
  readonly cornersRounded: boolean
  readonly onToggleCorners: () => void
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
/** SHARE = the universal export glyph (a tray with an arrow leaving it). Same
 *  22px / 1.6-stroke line language as the other tabs; no filled SaaS icon. */
function ShareIcon({ className }: IconProps): ReactElement {
  return (
    <svg className={className} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 14V3.5" />
      <path d="M7.5 7L11 3.5 14.5 7" />
      <path d="M5 11.5v6a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5v-6" />
    </svg>
  )
}
/** CORNERS = a card glyph whose own corners follow the current state (rounded
 *  square when on, sharp square when off) so the icon shows what cards look like. */
function CornersIcon({ className, rounded }: IconProps & { readonly rounded: boolean }): ReactElement {
  return (
    <svg className={className} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="14" height="14" rx={rounded ? 4.5 : 0} />
    </svg>
  )
}
/** MORE = three dots (universal overflow glyph) — clearer than a gear, which
 *  read as a theme/contrast icon next to the THEME tab. */
function MoreIcon({ className }: IconProps): ReactElement {
  return (
    <svg className={className} viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="5" cy="11" r="1.7" fill="currentColor" />
      <circle cx="11" cy="11" r="1.7" fill="currentColor" />
      <circle cx="17" cy="11" r="1.7" fill="currentColor" />
    </svg>
  )
}

export function BoardMobileNav({
  onTag,
  tagActive,
  onThemes,
  themesActive,
  onShare,
  cornersRounded,
  onToggleCorners,
  onSettings,
  settingsActive,
}: BoardMobileNavProps): ReactElement {
  return (
    <nav className={styles.nav} data-testid="board-mobile-nav" aria-label="Board controls">
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
        onClick={onShare}
        data-testid="mobile-nav-share"
      >
        <ShareIcon className={styles.icon} />
        <span className={styles.tabLabel}>SHARE</span>
      </button>
      <button
        type="button"
        className={styles.tab}
        data-active={cornersRounded ? 'true' : 'false'}
        aria-pressed={cornersRounded}
        onClick={onToggleCorners}
        data-testid="mobile-nav-corners"
      >
        <CornersIcon className={styles.icon} rounded={cornersRounded} />
        <span className={styles.tabLabel}>CORNERS</span>
      </button>
      <button
        type="button"
        className={styles.tab}
        data-active={settingsActive ? 'true' : 'false'}
        onClick={onSettings}
        data-testid="mobile-nav-settings"
      >
        <MoreIcon className={styles.icon} />
        <span className={styles.tabLabel}>MORE</span>
      </button>
    </nav>
  )
}
