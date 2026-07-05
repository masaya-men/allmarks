import { shouldShowQuickTagWindow } from '@/lib/tagger/quick-tag-apply'

export type SaveOutcome = 'saved' | 'duplicate' | 'error'

/**
 * How the /save confirmation should present itself.
 * - `normal`      — the intended 256×256 corner popup (windowed browser).
 * - `tab-minimal` — forced-into-a-tab (macOS fullscreen) but PopOut is open, so
 *                   the save confirmation shows there; close this tab fast.
 * - `tab-explain` — forced-into-a-tab, no PopOut, first time: teach why + how to
 *                   avoid it, dismissed manually.
 * - `tab-confirm` — forced-into-a-tab, no PopOut, already taught: a quiet
 *                   centered "Saved" that auto-closes.
 */
export type SaveWindowMode = 'normal' | 'tab-minimal' | 'tab-explain' | 'tab-confirm'

export interface SaveWindowPlan {
  /** Render the fullscreen explanation card (mode === 'tab-explain'). */
  readonly showExplanation: boolean
  /** Render the optional tag UI under the Saved confirmation. */
  readonly showTags: boolean
  /** Auto-close delay; null means "lifecycle (engage/leave/✕/GOT IT) owns the close". */
  readonly autoCloseMs: number | null
  /** Presentation mode — drives SaveToast layout. */
  readonly mode: SaveWindowMode
}

/** Saved / Already saved sit on screen long enough to read when no tags follow. */
export const SAVED_AUTOCLOSE_MS = 1800
/** Failed lingers a touch longer so the user registers it. */
export const ERROR_AUTOCLOSE_MS = 2400
/** PopOut already shows the saved card — flash this tab for the minimum needed
 *  to let the bookmark-saved broadcast reach the PopOut, then close. */
export const TAB_MINIMAL_CLOSE_MS = 250
/** Quiet centered "Saved" in a forced tab, after the one-time notice was seen. */
export const TAB_CONFIRM_CLOSE_MS = 1300

/** Intended popup is 256×256; anything meaningfully larger means the browser
 *  ignored the size request and opened a full tab (macOS Chrome does this in
 *  fullscreen). Kept well above Chrome's minimum popup size so a slightly
 *  bumped popup never reads as a tab. */
export const POPUP_DETECT_MAX_W = 460
export const POPUP_DETECT_MAX_H = 620

export function isOpenedAsTab(dims: { innerWidth: number; innerHeight: number }): boolean {
  return dims.innerWidth > POPUP_DETECT_MAX_W || dims.innerHeight > POPUP_DETECT_MAX_H
}

/**
 * Decide what the deliberate /save confirmation window shows after a save.
 *
 * Windowed (openedAsTab=false): unchanged legacy behavior — tags appear on a
 * successful/duplicate save when quick-tag is ON and no real PiP is open.
 *
 * Forced-tab (openedAsTab=true, macOS fullscreen): never show tags (tag later
 * on the board). If PopOut is open the confirmation lives there → close fast;
 * otherwise show the one-time fullscreen explanation, then a quiet auto-closing
 * "Saved" on subsequent saves.
 */
export function planSaveWindow(
  outcome: SaveOutcome,
  quickTagEnabled: boolean,
  pipActive: boolean,
  openedAsTab: boolean,
  fullscreenNoticeSeen: boolean,
): SaveWindowPlan {
  if (outcome === 'error') {
    return { mode: 'normal', showTags: false, showExplanation: false, autoCloseMs: ERROR_AUTOCLOSE_MS }
  }

  if (!openedAsTab) {
    const showTags = shouldShowQuickTagWindow(quickTagEnabled, pipActive)
    return { mode: 'normal', showTags, showExplanation: false, autoCloseMs: showTags ? null : SAVED_AUTOCLOSE_MS }
  }

  if (pipActive) {
    return { mode: 'tab-minimal', showTags: false, showExplanation: false, autoCloseMs: TAB_MINIMAL_CLOSE_MS }
  }
  if (!fullscreenNoticeSeen) {
    return { mode: 'tab-explain', showTags: false, showExplanation: true, autoCloseMs: null }
  }
  return { mode: 'tab-confirm', showTags: false, showExplanation: false, autoCloseMs: TAB_CONFIRM_CLOSE_MS }
}
