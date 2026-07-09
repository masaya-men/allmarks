'use client'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { normalizeToUrl } from '@/lib/board/paste-url'
import type { SaveOutcome } from '@/lib/board/use-save-url'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import styles from './MobileSaveSheet.module.css'

/** Bottom sheet URL input — the fallback when the smart + button can't read a
 *  URL from the clipboard. ADD validates via normalizeToUrl; a valid URL is
 *  saved (sheet closes on saved/duplicate — the board's PasteSaveFeedback shows
 *  the outcome), an invalid one keeps the sheet open with a quiet red hint. */
export function MobileSaveSheet({
  open,
  onClose,
  onSave,
  themeId,
}: {
  readonly open: boolean
  readonly onClose: () => void
  readonly onSave: (url: string) => Promise<SaveOutcome>
  readonly themeId: string
}): ReactElement | null {
  const { t } = useI18n()
  const [value, setValue] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setValue('')
      setInvalid(false)
      // Focus after the sheet mounts so the keyboard rises.
      const id = window.setTimeout(() => inputRef.current?.focus(), 60)
      return (): void => window.clearTimeout(id)
    }
  }, [open])

  if (!open) return null

  const submit = async (): Promise<void> => {
    if (busy) return
    const url = normalizeToUrl(value)
    if (!url) {
      setInvalid(true)
      return
    }
    setBusy(true)
    try {
      await onSave(url) // saved OR duplicate → close; board shows the pill
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={styles.overlay}
      style={{ zIndex: BOARD_Z_INDEX.SAVE_SHEET }}
      data-theme-id={themeId}
      onClick={onClose}
      data-testid="mobile-save-sheet"
    >
      <div className={styles.sheet} role="dialog" aria-label="Add bookmark" onClick={(e): void => e.stopPropagation()}>
        <div className={styles.grip} aria-hidden="true" />
        <div className={styles.row}>
          <input
            ref={inputRef}
            type="url"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className={styles.input}
            placeholder={t('board.urlPlaceholder')}
            value={value}
            data-testid="mobile-save-input"
            onChange={(e): void => { setValue(e.target.value); setInvalid(false) }}
            onKeyDown={(e): void => { if (e.key === 'Enter') void submit() }}
          />
          <button
            type="button"
            className={styles.add}
            disabled={busy}
            data-testid="mobile-save-add"
            onClick={(): void => { void submit() }}
          >
            ADD
          </button>
        </div>
        {invalid && <p className={styles.hint} data-testid="mobile-save-hint">{t('board.saveInvalidHint')}</p>}
      </div>
    </div>
  )
}
