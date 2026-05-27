'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import styles from './NewMoodInput.module.css'

type Props = {
  readonly onCreate: (name: string) => void
}

/** Inline "+ TAG" trigger that toggles into an underline input field on
 *  click. Label matches the board CardsLayer + TAG affordance so users
 *  see one vocabulary across the app. Esc cancels, Enter commits, blur
 *  also commits when the field has a value. */
export function NewMoodInput({ onCreate }: Props): ReactElement {
  const [expanded, setExpanded] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Focus on expand. requestAnimationFrame is needed because React
  // commits the <input> in the same frame and immediate focus() can
  // race the animation-driven layout.
  useEffect(() => {
    if (!expanded) return
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return (): void => cancelAnimationFrame(id)
  }, [expanded])

  const commitAndClose = (): void => {
    const trimmed = value.trim()
    if (trimmed) onCreate(trimmed)
    setValue('')
    setExpanded(false)
  }
  const cancelAndClose = (): void => {
    setValue('')
    setExpanded(false)
  }

  if (expanded) {
    return (
      <input
        ref={inputRef}
        className={styles.input}
        value={value}
        onChange={(e): void => setValue(e.target.value)}
        onBlur={commitAndClose}
        onKeyDown={(e): void => {
          if (e.key === 'Enter')  { e.preventDefault(); commitAndClose() }
          if (e.key === 'Escape') { e.preventDefault(); cancelAndClose() }
        }}
        placeholder="TAG NAME"
        data-testid="new-tag-input"
      />
    )
  }
  return (
    <button
      type="button"
      className={styles.trigger}
      onClick={(): void => setExpanded(true)}
      data-testid="new-tag-trigger"
    >
      + TAG
    </button>
  )
}
