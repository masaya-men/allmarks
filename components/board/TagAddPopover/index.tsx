'use client'
import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import type { TagRecord } from '@/lib/storage/indexeddb'
import styles from './TagAddPopover.module.css'

/** Pre-ranked suggestion row. The popover renders these top-to-bottom in
 *  the SUGGESTED section without re-sorting — caller (CardsLayer) merges
 *  HeuristicTagger output (existing tags) and tag-candidates output (new
 *  names) by confidence and caps the list before passing it in. */
export type SuggestionEntry =
  | { readonly kind: 'existing'; readonly tagId: string }
  | { readonly kind: 'new'; readonly name: string }

export interface TagAddPopoverProps {
  allTags: readonly TagRecord[]
  currentTagIds: readonly string[]
  /** Already merged + ranked + capped (industry-standard 5) by caller. */
  suggestedEntries: readonly SuggestionEntry[]
  onAddExisting: (tagId: string) => void
  onAddNew: (name: string) => void
  onClose: () => void
}

export function TagAddPopover({
  allTags, currentTagIds, suggestedEntries, onAddExisting, onAddNew, onClose,
}: TagAddPopoverProps): JSX.Element {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Click outside to close — industry-standard popover dismiss. The + TAG
  // trigger button stops propagation on pointerdown/mousedown so re-clicking
  // it toggles via its own onClick handler instead of triggering this and
  // double-closing. Chip / input clicks land inside the ref and are skipped.
  useEffect(() => {
    function onPointerDownOutside(e: MouseEvent): void {
      if (!popoverRef.current) return
      if (popoverRef.current.contains(e.target as Node)) return
      onClose()
    }
    document.addEventListener('mousedown', onPointerDownOutside)
    return () => document.removeEventListener('mousedown', onPointerDownOutside)
  }, [onClose])

  function handleEnter(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key !== 'Enter') return
    const value = input.trim()
    if (!value) return
    onAddNew(value)
    setInput('')
  }

  // Existing tags already promoted into SUGGESTED must not also appear in
  // ALL TAGS — split allTags by membership.
  const suggestedExistingIds = new Set(
    suggestedEntries.flatMap((e) => (e.kind === 'existing' ? [e.tagId] : [])),
  )
  const otherTags = allTags.filter((t) => !suggestedExistingIds.has(t.id))

  function renderExistingChip(tag: TagRecord): JSX.Element {
    const has = currentTagIds.includes(tag.id)
    return (
      <button
        key={tag.id}
        type="button"
        className={styles.chip}
        data-has={has ? 'true' : 'false'}
        onClick={() => onAddExisting(tag.id)}
      >
        {has ? '✓ ' : ''}{tag.name}
      </button>
    )
  }

  return (
    <div ref={popoverRef} className={styles.popover} role="dialog">
      {suggestedEntries.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>SUGGESTED</div>
          <div className={styles.chipRow}>
            {suggestedEntries.map((entry) => {
              if (entry.kind === 'existing') {
                const tag = allTags.find((t) => t.id === entry.tagId)
                if (!tag) return null
                return renderExistingChip(tag)
              }
              return (
                <button
                  key={`new-${entry.name}`}
                  type="button"
                  className={styles.chipNew}
                  onClick={() => onAddNew(entry.name)}
                >
                  + {entry.name}
                </button>
              )
            })}
          </div>
        </div>
      )}
      {otherTags.length > 0 && (
        <div className={styles.section}>
          {suggestedEntries.length > 0 && (
            <div className={styles.sectionHeader}>ALL TAGS</div>
          )}
          <div className={styles.chipRow}>
            {otherTags.map(renderExistingChip)}
          </div>
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
