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
import { ChromeButton } from './ChromeButton'
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
}

/** Hover-open leave grace, copied from TuneTrigger so the SETTINGS drawer
 *  forgives a brief pointer slip between the trigger and the drawer. */
const LEAVE_GRACE_MS = 700

export function ExtensionEntry({
  quickTagEnabled,
  onQuickTagToggle,
}: ExtensionEntryProps): ReactElement {
  const installed = useExtensionInstalled()
  // `open`/`setOpen` + the outside-click effect drive the NOT-installed
  // GET EXTENSION promo (click to toggle). The installed SETTINGS drawer is
  // hover-driven via `expanded` (TUNE mechanics) and never touches `open`.
  const [open, setOpen] = useState(false)
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

  // Close the promo on outside-click / ESC. The board's interaction layer
  // swallows pointer/mouse-down in the bubble phase (pan capture), so we
  // listen in the CAPTURE phase to catch the press before it's stopped —
  // otherwise clicking the canvas wouldn't dismiss the promo. Only the
  // NOT-installed branch sets `open`, so this early-returns for the
  // installed (hover) branch.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent): void => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return (): void => {
      document.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (installed) {
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
          aria-pressed={expanded}
          data-testid="extension-settings"
        />
        <div
          className={styles.drawer}
          role="dialog"
          aria-label="AllMarks settings"
          data-open={expanded ? 'true' : 'false'}
          aria-hidden={!expanded}
        >
          <div className={styles.title}>SETTINGS</div>
          <label className={styles.toggleRow}>
            <span className={styles.toggleLabel}>QUICK-TAG ON SAVE</span>
            <input
              type="checkbox"
              className={styles.toggle}
              checked={quickTagEnabled}
              onChange={(e): void => onQuickTagToggle(e.target.checked)}
              data-testid="quick-tag-toggle"
            />
          </label>
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
        </div>
      </span>
    )
  }

  const hasStore = EXTENSION_STORE_URL.length > 0

  return (
    <span ref={wrapRef} className={styles.wrap}>
      <ChromeButton
        label="GET EXTENSION"
        onClick={(): void => setOpen((v) => !v)}
        aria-pressed={open}
        data-testid="get-extension"
      />
      {open && (
        <div className={styles.promo} role="dialog" aria-label="Get the AllMarks extension">
          <button
            type="button"
            className={styles.close}
            onClick={(): void => setOpen(false)}
            aria-label="Close"
            data-testid="get-extension-close"
          >
            ×
          </button>
          <div className={styles.title}>ALLMARKS EXTENSION</div>
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
              onClick={(): void => setOpen(false)}
            >
              ADD TO CHROME
            </a>
          ) : (
            <span className={styles.soon} aria-disabled="true">
              COMING SOON
            </span>
          )}
        </div>
      )}
    </span>
  )
}
