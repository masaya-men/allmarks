'use client'
import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import type { TagRecord } from '@/lib/storage/indexeddb'
import styles from './TagAddPopover.module.css'

export interface TagAddPopoverProps {
  allTags: readonly TagRecord[]
  currentTagIds: readonly string[]
  siteCandidates: readonly string[]
  onAddExisting: (tagId: string) => void
  onAddNew: (name: string) => void
  onClose: () => void
}

export function TagAddPopover({
  allTags, currentTagIds, siteCandidates, onAddExisting, onAddNew, onClose,
}: TagAddPopoverProps): JSX.Element {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleEnter(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key !== 'Enter') return
    const value = input.trim()
    if (!value) return
    onAddNew(value)
    setInput('')
  }

  const newCandidates = siteCandidates.filter((s) => !allTags.some((t) => t.name === s))

  return (
    <div className={styles.popover} role="dialog">
      {allTags.length > 0 && (
        <div className={styles.section}>
          {allTags.map((t) => {
            const has = currentTagIds.includes(t.id)
            return (
              <button
                key={t.id}
                type="button"
                className={styles.chip}
                data-has={has ? 'true' : 'false'}
                onClick={() => onAddExisting(t.id)}
              >
                {has ? '✓ ' : ''}{t.name}
              </button>
            )
          })}
        </div>
      )}
      {newCandidates.length > 0 && (
        <div className={styles.section}>
          {newCandidates.map((s) => (
            <button
              key={s}
              type="button"
              className={styles.chipNew}
              onClick={() => onAddNew(s)}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        type="text"
        className={styles.input}
        placeholder="new tag…"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleEnter}
      />
    </div>
  )
}
