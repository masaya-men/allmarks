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
  /** Request a close. The parent should start the exit animation (set
   *  `closing`); the popover stays mounted until its exit transition ends,
   *  then fires `onExited`. Esc / click-outside / add-new all route here. */
  onClose: () => void
  /** When true, the popover plays its exit animation. Optional so existing
   *  unit tests can mount the popover without driving the open/close
   *  lifecycle. Defaults to false (= visible / playing the enter animation). */
  closing?: boolean
  /** Fired once the exit animation finishes so the parent can unmount. */
  onExited?: () => void
  /** Compact mode for tight surfaces (= the PiP window). Fills the parent's
   *  width (drops the 220px min-width), stacks chips in a single column, and
   *  scrolls internally instead of growing. The board leaves this off and
   *  keeps the default wrap layout. */
  compact?: boolean
}

export function TagAddPopover({
  allTags, currentTagIds, suggestedEntries, onAddExisting, onAddNew, onClose,
  closing = false, onExited, compact = false,
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

  // Click outside to close — industry-standard popover dismiss. Listens on
  // `pointerdown` rather than `mousedown` because the BoardRoot's
  // InteractionLayer calls e.preventDefault() on bare-canvas pointerdown
  // (= for pan-drag suppression) which spec-wise suppresses the compatibility
  // mousedown event entirely. pointerdown still bubbles regardless of
  // preventDefault so the document listener fires for every off-popover
  // click. The + TAG trigger button stops propagation on its own
  // pointerdown/mousedown so re-clicking it toggles via its own onClick
  // handler instead of double-closing here. Chip / input clicks land inside
  // the ref and are skipped.
  useEffect(() => {
    function onPointerDownOutside(e: PointerEvent): void {
      if (!popoverRef.current) return
      if (popoverRef.current.contains(e.target as Node)) return
      onClose()
    }
    document.addEventListener('pointerdown', onPointerDownOutside)
    return () => document.removeEventListener('pointerdown', onPointerDownOutside)
  }, [onClose])

  // Reduced-motion users get no exit animation, so onAnimationEnd never
  // fires — unmount immediately when a close is requested.
  useEffect(() => {
    if (!closing) return
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) onExited?.()
  }, [closing, onExited])

  // The popover keyframes (enter on mount, exit while [data-closing]) fire
  // animationend on the root. Only the EXIT end (closing === true) should
  // unmount; the enter end runs with closing === false and is ignored.
  function handleAnimationEnd(e: React.AnimationEvent<HTMLDivElement>): void {
    if (e.target !== popoverRef.current) return
    if (closing) onExited?.()
  }

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
        // Block focus-on-mouse-click so the chip doesn't keep a focus ring that
        // would light up the moment a board keyboard shortcut flips the page
        // into keyboard modality (same fix as the triage tag chips). Tab focus
        // is untouched.
        onMouseDown={(e): void => e.preventDefault()}
        onClick={() => onAddExisting(tag.id)}
      >
        {has ? '✓ ' : ''}{tag.name}
      </button>
    )
  }

  return (
    <div
      ref={popoverRef}
      className={styles.popover}
      role="dialog"
      data-closing={closing ? 'true' : undefined}
      data-compact={compact ? 'true' : undefined}
      onAnimationEnd={handleAnimationEnd}
    >
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
                  onMouseDown={(e): void => e.preventDefault()}
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
