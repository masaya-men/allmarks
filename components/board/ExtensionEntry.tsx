'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react'
import { createPortal } from 'react-dom'
import { EXTENSION_STORE_URL } from '@/lib/board/constants'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { ChromeButton } from './ChromeButton'
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
  themeId,
  onOpenThemeModal,
  customWidthCount,
  onResetCardSizes,
  onSortNewestFirst,
}: ExtensionEntryProps): ReactElement {
  const { t } = useI18n()
  const installed = useExtensionInstalled()
  const currentThemeName = t(getThemeMeta(themeId).labelKey)
  // SETTINGS is always shown (extension or not) so the QUICK-TAG ON SAVE
  // toggle is reachable by bookmarklet-only users too. The drawer is
  // hover-driven via `expanded` (TUNE mechanics). The not-installed state
  // folds the GET EXTENSION promo into the same drawer.
  const [expanded, setExpanded] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // True when the drawer is taller than the viewport allows AND there's more
  // content below the fold — drives the bottom fade hint (no raw scrollbar).
  const [moreBelow, setMoreBelow] = useState(false)
  // The drawer is portalled to <body> so it escapes the TopHeader's z-index:110
  // stacking context — otherwise the canvas ScrollMeter (z 400) paints over its
  // bottom. `pos` anchors the fixed drawer under the SETTINGS button.
  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  useEffect(() => setMounted(true), [])

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

  // Close immediately (no leave grace) — used when an action opens a modal so
  // the modal isn't briefly occluded by the higher-z portalled drawer.
  const closeNow = useCallback((): void => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
    setExpanded(false)
  }, [])

  // Anchor the portalled (fixed) drawer under the SETTINGS button. The header
  // doesn't move with board scroll, so measuring on open + resize is enough;
  // the capture-phase scroll listener covers any incidental layout shift.
  const measure = useCallback((): void => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ top: Math.round(r.bottom), right: Math.round(window.innerWidth - r.right) })
  }, [])

  useLayoutEffect(() => {
    if (!mounted) return
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return (): void => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [mounted, measure])

  useEffect(() => {
    return (): void => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    }
  }, [])

  const hasStore = EXTENSION_STORE_URL.length > 0
  // Onboarding's SETTINGS beat forces the drawer open; otherwise it's hover-driven.
  const isOpen = forceOpen || expanded

  // N-19: two-tap confirm shared by the two LAYOUT buttons. First tap arms a
  // button (label → TAP AGAIN TO CONFIRM) for CONFIRM_MS; second tap fires.
  // Arming one disarms the other; closing the drawer or the timeout disarms.
  const CONFIRM_MS = 3000
  const [confirming, setConfirming] = useState<'sizes' | 'sort' | null>(null)
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

  // Show the bottom fade only while there's more content below the fold. The
  // drawer caps its height to the viewport (see CSS), so a tall state (e.g. the
  // GET EXTENSION promo on a short window) scrolls; the fade hints at it.
  const recomputeFade = useCallback((): void => {
    const el = drawerRef.current
    if (!el) return
    setMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 4)
  }, [])

  // Onboarding SETTINGS beat: pin the QUICK-TAG toggle at the top of the drawer.
  // The drawer is tall now (LAYOUT/THEME/HOW-TO/EXTENSION), so a stray scroll
  // would push the toggle out of the visible clip and the spotlight ring — which
  // tracks the toggle's live rect — would drift onto the header. We reset the
  // scroll to the top and (via the render below) lock scrolling while the beat is
  // active, so the ring stays on the toggle. Normal hover-open scrolls freely.
  useEffect(() => {
    if (!forceOpen) return
    const el = drawerRef.current
    if (!el) return
    el.scrollTop = 0
    const raf = requestAnimationFrame(() => { el.scrollTop = 0 })
    return (): void => cancelAnimationFrame(raf)
  }, [forceOpen])

  useEffect(() => {
    if (!isOpen) {
      setMoreBelow(false)
      return
    }
    measure() // refresh anchor when the drawer opens
    // Measure after the max-height open transition settles (clientHeight grows
    // during it), and once more on the next frame for the fits-immediately case.
    const raf = requestAnimationFrame(recomputeFade)
    const timer = window.setTimeout(recomputeFade, 560)
    window.addEventListener('resize', recomputeFade)
    return (): void => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
      window.removeEventListener('resize', recomputeFade)
    }
  }, [isOpen, installed, recomputeFade, measure])

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
      {mounted && createPortal(
      <div
        className={styles.drawer}
        style={pos ? { position: 'fixed', top: pos.top, right: pos.right } : undefined}
        role="dialog"
        aria-label="AllMarks settings"
        data-open={isOpen ? 'true' : 'false'}
        aria-hidden={!isOpen}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Inner scroll region — the drawer shell itself stays put so the bottom
            fade below can anchor to its visible bottom edge. */}
        <div
          className={styles.drawerScroll}
          ref={drawerRef}
          onScroll={recomputeFade}
          // Onboarding beat locks the scroll so the spotlighted toggle stays put.
          style={forceOpen ? { overflowY: 'hidden' } : undefined}
        >
        <div className={styles.title}>SETTINGS</div>

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
              <BackupButton buttonClassName={styles.backupBtn} />
            </div>
            <BackupStatus />
          </div>
        </section>

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
            onClick={(): void => { closeNow(); onOpenThemeModal() }}
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
            onClick={(): void => { closeNow(); onOpenBookmarkletModal() }}
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
        </div>
        {/* Bottom fade — hints at scrollable content below on short viewports
            (no raw scrollbar). Anchored to the drawer shell (which no longer
            scrolls), so it stays fixed at the visible bottom edge. */}
        <div
          className={styles.scrollFade}
          data-visible={moreBelow ? 'true' : 'false'}
          aria-hidden="true"
        />
      </div>,
      document.body,
      )}
    </span>
  )
}
