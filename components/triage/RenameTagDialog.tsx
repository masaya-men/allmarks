'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import styles from './RenameTagDialog.module.css'

type Props = {
  /** The tag's current name, pre-filled (and selected) in the input. */
  readonly currentName: string
  /** Names of every OTHER tag (case-insensitive duplicate guard so the
   *  user can't create two tags that read identically). */
  readonly existingNames: ReadonlyArray<string>
  /** Fired with the trimmed new name when the user confirms. The parent
   *  runs the actual rename + closes the dialog. */
  readonly onSubmit: (name: string) => void
  /** Fired on CANCEL, Esc, or backdrop click. */
  readonly onCancel: () => void
}

/** Inline rename dialog for a single tag. Same AllMarks editorial tonality
 *  as TagDeleteConfirmDialog (= black panel, monospace chrome) but with a
 *  text input instead of the hold-to-confirm. Enter saves, Esc / backdrop
 *  cancels. A case-insensitive duplicate of another tag blocks SAVE with a
 *  quiet amber hint. The input renders lowercase to match how tag names are
 *  shown everywhere; the stored value keeps the user's typed casing. */
export function RenameTagDialog({
  currentName, existingNames, onSubmit, onCancel,
}: Props): ReactElement {
  const [value, setValue] = useState<string>(currentName)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const el = inputRef.current
    if (el) { el.focus(); el.select() }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel() }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const trimmed = value.trim()
  const lower = trimmed.toLowerCase()
  const isDuplicate =
    lower.length > 0 && existingNames.some((n) => n.trim().toLowerCase() === lower)
  const canSave = trimmed.length > 0 && !isDuplicate

  const submit = (): void => { if (canSave) onSubmit(trimmed) }

  return (
    <div
      className={styles.backdrop}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tag-rename-heading"
      data-testid="tag-rename-dialog"
    >
      <div className={styles.panel} onClick={(e): void => e.stopPropagation()}>
        <div id="tag-rename-heading" className={styles.heading}>RENAME TAG</div>
        <input
          ref={inputRef}
          className={styles.input}
          value={value}
          onChange={(e): void => setValue(e.target.value)}
          onKeyDown={(e): void => {
            if (e.key === 'Enter') { e.preventDefault(); submit() }
          }}
          maxLength={40}
          spellCheck={false}
          aria-label="New tag name"
          data-testid="tag-rename-input"
        />
        <div className={styles.hint} data-error={isDuplicate ? 'true' : 'false'}>
          {isDuplicate
            ? `“${lower}” already exists`
            : 'Shown in lowercase everywhere'}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onCancel}
            data-testid="tag-rename-cancel"
          >
            CANCEL
          </button>
          <button
            type="button"
            className={styles.saveBtn}
            onClick={submit}
            disabled={!canSave}
            data-testid="tag-rename-save"
          >
            SAVE
          </button>
        </div>
      </div>
    </div>
  )
}
