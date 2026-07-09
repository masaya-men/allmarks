'use client'
import { useState, type ReactElement } from 'react'
import { normalizeToUrl } from '@/lib/board/paste-url'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import styles from './MobileSaveButton.module.css'

/** Floating "+" save entry for touch devices (phones + tablets). Tapping reads
 *  the clipboard: a URL saves immediately (no typing); anything else opens the
 *  input sheet via onNeedInput. iOS shows a one-time "Paste" confirmation
 *  (Apple privacy — unavoidable). Rendered only under a pointer:coarse gate in
 *  BoardRoot, so a mouse desktop never mounts it. */
export function MobileSaveButton({
  onSave,
  onNeedInput,
  themeId,
}: {
  /** Called with a normalized URL when the clipboard already holds one. */
  readonly onSave: (url: string) => void | Promise<void>
  /** Called when the clipboard is empty/unreadable/not a URL — caller opens
   *  the manual input sheet. */
  readonly onNeedInput: () => void
  /** Active board theme id, used to select the CSS skin override below. */
  readonly themeId: string
}): ReactElement {
  const [busy, setBusy] = useState(false)
  const handleTap = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    let text = ''
    try {
      text = (await navigator.clipboard?.readText?.()) ?? ''
    } catch {
      text = ''
    } finally {
      setBusy(false)
    }
    const url = normalizeToUrl(text)
    if (url) {
      void onSave(url)
    } else {
      onNeedInput()
    }
  }
  return (
    <button
      type="button"
      className={styles.button}
      style={{ zIndex: BOARD_Z_INDEX.SAVE_BUTTON }}
      data-theme-id={themeId}
      data-testid="mobile-save-button"
      aria-label="Add bookmark"
      onClick={(): void => { void handleTap() }}
    >
      <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  )
}
