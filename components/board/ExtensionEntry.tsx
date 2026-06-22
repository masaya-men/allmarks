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
import { BackupButton } from './BackupButton'
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
 * Header chrome entry, sits to the right of TUNE.
 *
 * - Extension installed → label `SETTINGS`; click asks the extension (via the
 *   content-script bridge) to open its options page.
 * - Extension absent → label `GET EXTENSION`; click opens a small promo
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
  /** When true (the onboarding SETTINGS beat), force the drawer open regardless
   *  of hover so the tutorial can spotlight the QUICK-TAG ON SAVE toggle inside
   *  (the drawer is hover-only; a guided demo can't hold a hover). */
  readonly forceOpen?: boolean
}

/** Hover-open leave grace, copied from TuneTrigger so the SETTINGS drawer
 *  forgives a brief pointer slip between the trigger and the drawer. */
const LEAVE_GRACE_MS = 700

export function ExtensionEntry({
  quickTagEnabled,
  onQuickTagToggle,
  onOpenBookmarkletModal,
  onReplayIntro,
  forceOpen = false,
}: ExtensionEntryProps): ReactElement {
  const { t } = useI18n()
  const installed = useExtensionInstalled()
  // SETTINGS is always shown (extension or not) so the QUICK-TAG ON SAVE
  // toggle is reachable by bookmarklet-only users too. The drawer is
  // hover-driven via `expanded` (TUNE mechanics). The not-installed state
  // folds the GET EXTENSION promo into the same drawer.
  const [expanded, setExpanded] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openSettings = useCallback((): void => {
    // Mirrors the url-deleted bridge (use-board-data.ts): the content script
    // listens on window 'message' for booklage.pages.dev and forwards to the
    // background SW, which calls chrome.runtime.openOptionsPage().
    window.postMessage({ type: 'allmarks:open-settings' }, '*')
  }, [])

  // TUNE-style hover open/close with a 700ms leave grace (no click-pin).
  const handleMouseEnter = useCallback((): void => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
    setExpanded(true)
  }, [])

  const handleMouseLeave = useCallback((): void => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    leaveTimerRef.current = setTimeout(() => {
      setExpanded(false)
      leaveTimerRef.current = null
    }, LEAVE_GRACE_MS)
  }, [])

  useEffect(() => {
    return (): void => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    }
  }, [])

  const hasStore = EXTENSION_STORE_URL.length > 0
  // Onboarding's SETTINGS beat forces the drawer open; otherwise it's hover-driven.
  const isOpen = forceOpen || expanded

  return (
    <span
      ref={wrapRef}
      className={styles.wrap}
      data-testid="extension-settings-wrap"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <ChromeButton
        label="SETTINGS"
        onClick={(): void => {}}
        aria-pressed={isOpen}
        data-testid="extension-settings"
        data-onboarding-target="settings"
      />
      <div
        className={styles.drawer}
        role="dialog"
        aria-label="AllMarks settings"
        data-open={isOpen ? 'true' : 'false'}
        aria-hidden={!isOpen}
      >
        <div className={styles.title}>SETTINGS</div>
        <label className={styles.toggleRow} data-onboarding-target="quick-tag-toggle">
          <span className={styles.toggleLabel}>QUICK-TAG ON SAVE</span>
          <input
            type="checkbox"
            className={styles.toggle}
            checked={quickTagEnabled}
            onChange={(e): void => onQuickTagToggle(e.target.checked)}
            data-testid="quick-tag-toggle"
          />
        </label>
        <div className={styles.backupSection} data-testid="backup-section">
          <div className={styles.backupLabel}>BACKUP</div>
          <p className={styles.backupCaption}>{t('board.backup.caption')}</p>
          <div className={styles.backupRow}>
            <BackupButton buttonClassName={styles.backupBtn} />
          </div>
        </div>
        <button
          type="button"
          className={styles.panelCta}
          onClick={onOpenBookmarkletModal}
          data-testid="open-bookmarklet-install"
        >
          SAVE WITHOUT EXTENSION
        </button>
        {onReplayIntro && (
          <button
            type="button"
            className={styles.panelCta}
            data-testid="replay-intro"
            onClick={onReplayIntro}
          >
            REPLAY INTRO
          </button>
        )}
        {installed ? (
          <button
            type="button"
            className={styles.panelCta}
            onClick={(): void => {
              openSettings()
            }}
            data-testid="open-extension-settings"
          >
            OPEN EXTENSION SETTINGS
          </button>
        ) : (
          <div className={styles.promoInline} data-testid="get-extension-block">
            <p className={styles.body}>
              Save any page to AllMarks in one click — straight from X, YouTube, and anywhere
              else. The floating mark and SNS auto-save come with it.
            </p>
            {hasStore ? (
              <a
                className={styles.cta}
                href={EXTENSION_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="get-extension"
              >
                ADD TO CHROME
              </a>
            ) : (
              <span className={styles.soon} aria-disabled="true" data-testid="get-extension">
                COMING SOON
              </span>
            )}
          </div>
        )}
      </div>
    </span>
  )
}
