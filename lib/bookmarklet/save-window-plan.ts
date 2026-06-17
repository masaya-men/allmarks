import { shouldShowQuickTagWindow } from '@/lib/tagger/quick-tag-apply'

export type SaveOutcome = 'saved' | 'duplicate' | 'error'

export interface SaveWindowPlan {
  /** Render the optional tag UI under the Saved confirmation. */
  readonly showTags: boolean
  /** Auto-close delay; null means "lifecycle (engage/leave/✕) owns the close". */
  readonly autoCloseMs: number | null
}

/** Saved / Already saved sit on screen long enough to read when no tags follow. */
export const SAVED_AUTOCLOSE_MS = 1800
/** Failed lingers a touch longer so the user registers it. */
export const ERROR_AUTOCLOSE_MS = 2400

/**
 * Decide what the deliberate /save confirmation window shows after a save.
 * Tags appear only on a successful/duplicate save when the quick-tag feature
 * is ON and no real PiP is open (PiP is the tag surface when present — mirrors
 * the phase-2 collision rule). When tags show, the window stays open under the
 * interaction lifecycle instead of auto-closing.
 */
export function planSaveWindow(
  outcome: SaveOutcome,
  quickTagEnabled: boolean,
  pipActive: boolean,
): SaveWindowPlan {
  if (outcome === 'error') return { showTags: false, autoCloseMs: ERROR_AUTOCLOSE_MS }
  const showTags = shouldShowQuickTagWindow(quickTagEnabled, pipActive)
  return { showTags, autoCloseMs: showTags ? null : SAVED_AUTOCLOSE_MS }
}
