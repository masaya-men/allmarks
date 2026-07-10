'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react'
import { EXTENSION_STORE_URL } from '@/lib/board/constants'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { ChromeButton } from './ChromeButton'
import { ChromeDrawer } from './ChromeDrawer'
import { BackupButton } from './BackupButton'
import { BackupStatus } from './BackupStatus'
import { getThemeMeta } from '@/lib/board/theme-registry'
import type { ThemeId } from '@/lib/board/types'
import styles from './ExtensionEntry.module.css'

/** Layout effect on the client, plain effect on the server (where layout
 *  effects don't run and React warns). Lets us flip to the installed state
 *  before first paint without a hydration mismatch. */
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

/** Reads the marker the extension's content script writes onto <html>
 *  (`data-booklage-extension="1"`). */
function readMarker(): boolean {
  return (
    typeof document !== 'undefined' &&
    document.documentElement.dataset.booklageExtension === '1'
  )
}

/** True once the AllMarks extension is detected on the page. Starts from a
 *  synchronous read (the content script usually sets the marker before React
 *  mounts), then re-checks a few times + via a MutationObserver so an
 *  installed user never sees the GET EXTENSION promo flash before it flips. */
function useExtensionInstalled(): boolean {
  // Start `false` so the first (hydration) render matches the server, which
  // never sees the marker. The layout effect below flips it before paint.
  const [installed, setInstalled] = useState<boolean>(false)
  useIsoLayoutEffect(() => {
    if (readMarker()) {
      setInstalled(true)
      return
    }
    const timers: number[] = []
    let obs: MutationObserver | null = null
    const check = (): void => {
      if (!readMarker()) return
      setInstalled(true)
      timers.forEach((t) => clearTimeout(t))
      obs?.disconnect()
    }
    ;[150, 500, 1200, 2500].forEach((ms) => timers.push(window.setTimeout(check, ms)))
    obs = new MutationObserver(check)
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-booklage-extension'],
    })
    return (): void => {
      timers.forEach((t) => clearTimeout(t))
      obs?.disconnect()
    }
  }, [])
  return installed
}

/**
 * Header chrome entry, sits to the right of TUNE. Trigger + a {@link ChromeDrawer}
 * (right-docked panel, click-open/close, shared with THEME/SHARE/TUNE).
 *
 * - Extension installed → EXTENSION section links to the options page.
 * - Extension absent → EXTENSION section folds in the GET EXTENSION promo
 *   explaining the one-click save + an `ADD TO CHROME` link to the store.
 *   While {@link EXTENSION_STORE_URL} is empty (pre-launch) the link degrades
 *   to a quiet "coming soon" instead of a dead 404.
 */
export interface ExtensionEntryProps {
  readonly quickTagEnabled: boolean
  readonly onQuickTagToggle: (next: boolean) => void
  /** Opens the bookmarklet install modal (drag-to-bookmark-bar). The permanent
   *  home for the no-extension save path now that the always-on board pill is
   *  gone — reachable here regardless of extension status (Firefox / Safari /
   *  mobile users still need it). */
  readonly onOpenBookmarkletModal: () => void
  /** When provided, shows a REPLAY INTRO button in the drawer that restarts
   *  the onboarding animation sequence. */
  readonly onReplayIntro?: () => void
  /** Externally controlled open state (BoardRoot's `activeDrawer === 'settings'`). */
  readonly isOpen: boolean
  /** Requests the drawer open/close — the trigger click and the drawer's own
   *  close (Esc/outside-click/× button) all route through this. */
  readonly onOpenChange: (open: boolean) => void
  /** Active board theme — shown as the current selection under the THEME group's
   *  "CHOOSE A THEME" button. */
  readonly themeId: ThemeId
  /** Opens the dedicated theme screen (rendered at the board root so it escapes
   *  this drawer's `overflow: hidden`). */
  readonly onOpenThemeModal: () => void
  /** N-19: number of cards with a manual custom width. Drives the RESET CARD
   *  SIZES button's count + disabled (0 = nothing to reset). */
  readonly customWidthCount: number
  /** N-19: clear every card's manual resize (bulk). */
  readonly onResetCardSizes: () => void
  /** N-19: re-sort the board to newest-first. */
  readonly onSortNewestFirst: () => void
  /** Mobile only: MOTION lives here because the bottom nav gave its slot to
   *  SHARE (N-49). BoardRoot passes this only when `useIsMobile()` is true, so
   *  the desktop drawer — which already has MOTION in the top chrome — is
   *  byte-identical. */
  readonly motion?: { readonly enabled: boolean; readonly onToggle: () => void }
}

export function ExtensionEntry({
  quickTagEnabled,
  onQuickTagToggle,
  onOpenBookmarkletModal,
  onReplayIntro,
  isOpen,
  onOpenChange,
  themeId,
  onOpenThemeModal,
  customWidthCount,
  onResetCardSizes,
  onSortNewestFirst,
  motion,
}: ExtensionEntryProps): ReactElement {
  const { t } = useI18n()
  const installed = useExtensionInstalled()
  const currentThemeName = t(getThemeMeta(themeId).labelKey)

  const openSettings = useCallback((): void => {
    // Mirrors the url-deleted bridge (use-board-data.ts): the content script
    // listens on window 'message' for booklage.pages.dev and forwards to the
    // background SW, which calls chrome.runtime.openOptionsPage().
    window.postMessage({ type: 'allmarks:open-settings' }, '*')
  }, [])

  const hasStore = EXTENSION_STORE_URL.length > 0

  // N-19: two-tap confirm shared by the two LAYOUT buttons. First tap arms a
  // button (label → TAP AGAIN TO CONFIRM) for CONFIRM_MS; second tap fires.
  // Arming one disarms the other; closing the drawer or the timeout disarms.
  const CONFIRM_MS = 3000
  const [confirming, setConfirming] = useState<'sizes' | 'sort' | null>(null)
  // Bumped on a successful EXPORT so the "last backup" line re-reads live.
  const [backupToken, setBackupToken] = useState(0)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const disarm = useCallback((): void => {
    if (confirmTimerRef.current) {
      clearTimeout(confirmTimerRef.current)
      confirmTimerRef.current = null
    }
    setConfirming(null)
  }, [])
  const armOrFire = useCallback(
    (which: 'sizes' | 'sort', fire: () => void): void => {
      if (confirming === which) {
        disarm()
        fire()
        return
      }
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
      setConfirming(which)
      confirmTimerRef.current = setTimeout(() => {
        setConfirming(null)
        confirmTimerRef.current = null
      }, CONFIRM_MS)
    },
    [confirming, disarm],
  )
  // Disarm whenever the drawer closes so a stale confirm never lingers.
  useEffect(() => {
    if (!isOpen) disarm()
  }, [isOpen, disarm])
  useEffect(() => () => { if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current) }, [])

  return (
    <>
      <ChromeButton
        label="SETTINGS"
        onClick={(): void => onOpenChange(!isOpen)}
        aria-pressed={isOpen}
        data-testid="extension-settings"
        data-onboarding-target="settings"
      />
      <ChromeDrawer
        isOpen={isOpen}
        onClose={(): void => onOpenChange(false)}
        title="SETTINGS"
        testId="extension-settings-drawer"
        closeLabel={t('board.theme.modalCloseLabel')}
      >
        {/* ── SAVING ───────────────────────────────────────────────────────
            Everyday data settings: quick-tag-on-save + the file backup. */}
        <section className={styles.group}>
          <div className={styles.groupLabel}>SAVING</div>
          <label className={styles.toggleRow} data-onboarding-target="quick-tag-toggle">
            <span className={styles.toggleLabel}>{t('board.settings.quickTagOnSave')}</span>
            <input
              type="checkbox"
              className={styles.toggle}
              checked={quickTagEnabled}
              onChange={(e): void => onQuickTagToggle(e.target.checked)}
              data-testid="quick-tag-toggle"
            />
          </label>
          <div className={styles.backupSection} data-testid="backup-section">
            <p className={styles.backupCaption}>{t('board.backup.caption')}</p>
            <div className={styles.backupRow}>
              <BackupButton
                buttonClassName={styles.backupBtn}
                onExported={(): void => setBackupToken((n) => n + 1)}
              />
            </div>
            <BackupStatus refreshKey={`${isOpen ? 'open' : 'closed'}:${backupToken}`} />
          </div>
        </section>

        {/* ── VIEW ──────────────────────────────────────────────────────────
            Mobile only. MOTION used to be a bottom-nav tab; SHARE took that
            slot (N-49). It is a set-once display preference, so a drawer row
            is the right home. Desktop keeps its top-chrome MotionToggle and
            never renders this section (BoardRoot passes no `motion` prop). */}
        {motion && (
          <section className={styles.group}>
            <div className={styles.groupLabel}>VIEW</div>
            <label className={styles.toggleRow}>
              <span className={styles.toggleLabel}>MOTION</span>
              <input
                type="checkbox"
                className={styles.toggle}
                checked={motion.enabled}
                onChange={(): void => motion.onToggle()}
                data-testid="settings-motion-toggle"
              />
            </label>
          </section>
        )}

        {/* ── LAYOUT ────────────────────────────────────────────────────────
            N-19: restore the board to defaults. Both actions two-tap confirm
            (no modal); the EXPORT backup above is the ultimate safety net. */}
        <section className={styles.group}>
          <div className={styles.groupLabel}>{t('board.settings.layoutGroup')}</div>
          <button
            type="button"
            className={styles.panelCta}
            data-testid="layout-reset-sizes"
            data-confirming={confirming === 'sizes' ? 'true' : 'false'}
            disabled={customWidthCount === 0}
            onClick={(): void => armOrFire('sizes', onResetCardSizes)}
          >
            {confirming === 'sizes'
              ? t('board.settings.tapAgainToConfirm')
              : customWidthCount > 0
                ? `${t('board.settings.resetCardSizes')} (${customWidthCount})`
                : t('board.settings.resetCardSizes')}
          </button>
          <button
            type="button"
            className={styles.panelCta}
            data-testid="layout-sort-newest"
            data-confirming={confirming === 'sort' ? 'true' : 'false'}
            onClick={(): void => armOrFire('sort', onSortNewestFirst)}
          >
            {confirming === 'sort'
              ? t('board.settings.tapAgainToConfirm')
              : t('board.settings.sortNewestFirst')}
          </button>
          <p className={styles.layoutNote}>{t('board.settings.sortNewestNote')}</p>
        </section>

        {/* ── THEME ────────────────────────────────────────────────────────
            One button → the dedicated theme screen (gallery + later preview +
            customization). Keeping the heavy swatch grid out of this drawer is
            what brings its height back under the max-height cap. */}
        <section className={styles.group}>
          <div className={styles.groupLabel}>THEME</div>
          <button
            type="button"
            className={styles.themePickBtn}
            onClick={onOpenThemeModal}
            data-testid="open-theme-modal"
          >
            <span className={styles.themePickLabel}>{t('board.settings.chooseTheme')}</span>
            <span className={styles.themeCurrent}>{currentThemeName}</span>
          </button>
        </section>

        {/* ── HOW TO USE ───────────────────────────────────────────────────
            Bookmarklet save (cross-browser) + replay the onboarding tour. */}
        <section className={styles.group}>
          <div className={styles.groupLabel}>HOW TO USE</div>
          <button
            type="button"
            className={styles.panelCta}
            onClick={(): void => { onOpenChange(false); onOpenBookmarkletModal() }}
            data-testid="open-bookmarklet-install"
          >
            {t('board.settings.saveWithoutExtension')}
          </button>
          {onReplayIntro && (
            <button
              type="button"
              className={styles.panelCta}
              data-testid="replay-intro"
              onClick={onReplayIntro}
            >
              {t('board.settings.replayIntro')}
            </button>
          )}
        </section>

        {/* ── EXTENSION ────────────────────────────────────────────────────
            Installed → open the options page. Absent → the GET EXTENSION promo. */}
        <section className={styles.group}>
          <div className={styles.groupLabel}>EXTENSION</div>
          {installed ? (
            <button
              type="button"
              className={styles.panelCta}
              onClick={(): void => {
                openSettings()
              }}
              data-testid="open-extension-settings"
            >
              {t('board.settings.openExtensionSettings')}
            </button>
          ) : (
            <div className={styles.promoInline} data-testid="get-extension-block">
              <p className={styles.body}>{t('board.settings.getExtensionBody')}</p>
              {hasStore ? (
                <a
                  className={styles.cta}
                  href={EXTENSION_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="get-extension"
                >
                  {t('board.settings.addToChrome')}
                </a>
              ) : (
                <span className={styles.soon} aria-disabled="true" data-testid="get-extension">
                  {t('board.settings.comingSoon')}
                </span>
              )}
            </div>
          )}
        </section>
      </ChromeDrawer>
    </>
  )
}
