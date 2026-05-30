'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'

/**
 * Shared in-place tag rename behaviour for the filter dropdown rows and the
 * triage chips. The tag name becomes a text input wherever the user invokes
 * "Rename"; Enter commits, Esc cancels, blur commits when valid. A
 * case-insensitive duplicate of any OTHER tag blocks the commit (gently — the
 * field reverts on blur, holds on Enter) so the user can never end up with two
 * tags that read identically.
 *
 * The stored value keeps the user's typed casing; the display is lowercased via
 * CSS where the field renders (matching how tag names appear everywhere).
 *
 * @param currentName - the tag's name, pre-filled and selected on focus
 * @param otherNames  - names of every OTHER tag (the duplicate guard set)
 * @param onSubmit    - fired once with the trimmed new name on a valid commit
 * @param onCancel    - fired once when the edit is abandoned (Esc / invalid blur)
 */
export function useInlineTagRename({
  currentName,
  otherNames,
  onSubmit,
  onCancel,
}: {
  currentName: string
  otherNames: readonly string[]
  onSubmit: (name: string) => void
  onCancel: () => void
}): {
  /** The live field value. */
  value: string
  /** True when the trimmed value collides (case-insensitive) with another tag. */
  isDuplicate: boolean
  /** Spread onto the <input>. Caller supplies className / data-testid. */
  inputProps: {
    ref: (el: HTMLInputElement | null) => void
    value: string
    onChange: (e: ChangeEvent<HTMLInputElement>) => void
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void
    onBlur: () => void
    onPointerDown: (e: { stopPropagation: () => void }) => void
    onClick: (e: { stopPropagation: () => void }) => void
    spellCheck: boolean
    maxLength: number
    'aria-label': string
  }
} {
  const [value, setValue] = useState(currentName)
  // Guards against the commit firing twice: pressing Enter commits then the
  // input unmounts and would also fire onBlur.
  const doneRef = useRef(false)

  // Focus + select on mount. rAF lets React commit the <input> first, matching
  // NewMoodInput's pattern so focus doesn't race the layout.
  const focus = useCallback((el: HTMLInputElement | null): void => {
    if (!el) return
    requestAnimationFrame(() => { el.focus(); el.select() })
  }, [])

  const trimmed = value.trim()
  const lower = trimmed.toLowerCase()
  const isDuplicate =
    lower.length > 0 && otherNames.some((n) => n.trim().toLowerCase() === lower)
  const canCommit = trimmed.length > 0 && !isDuplicate

  const commit = useCallback((): void => {
    if (doneRef.current) return
    doneRef.current = true
    if (trimmed.length > 0 && !isDuplicate && trimmed !== currentName) {
      onSubmit(trimmed)
    } else {
      onCancel()
    }
  }, [trimmed, isDuplicate, currentName, onSubmit, onCancel])

  const cancel = useCallback((): void => {
    if (doneRef.current) return
    doneRef.current = true
    onCancel()
  }, [onCancel])

  // Reset the once-guard if the same hook instance is reused for a new tag.
  useEffect(() => { doneRef.current = false }, [currentName])

  return {
    value,
    isDuplicate,
    inputProps: {
      ref: focus,
      value,
      onChange: (e): void => setValue(e.target.value),
      onKeyDown: (e): void => {
        if (e.key === 'Enter') {
          e.preventDefault()
          // Hold the field open on a duplicate / empty value instead of
          // silently discarding the edit.
          if (canCommit) commit()
          return
        }
        if (e.key === 'Escape') { e.preventDefault(); cancel() }
      },
      onBlur: commit,
      // Keep the gesture off the row's click-to-filter / reorder-drag seed.
      onPointerDown: (e): void => e.stopPropagation(),
      onClick: (e): void => e.stopPropagation(),
      spellCheck: false,
      maxLength: 40,
      'aria-label': 'Rename tag',
    },
  }
}
