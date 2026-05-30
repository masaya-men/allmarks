'use client'

import { useEffect, type MouseEvent as ReactMouseEvent, type ReactElement } from 'react'
import type { TagRecord } from '@/lib/storage/indexeddb'
import { NewMoodInput } from './NewMoodInput'
import styles from './TagPicker.module.css'

/** Keyboard handler hook for 1-9 armed-tag toggle, Space → No, Z → undo.
 *  Direction keys (Arrow / WASD) are handled in TriagePage itself
 *  alongside Esc. Skips input/textarea targets. */
export function useTagPickerKeys({
  tags, onToggleArmed, onNo, onUndo,
}: {
  tags: ReadonlyArray<TagRecord>
  onToggleArmed: (tagId: string) => void
  onNo: () => void
  onUndo: (() => void) | null
}): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.key >= '1' && e.key <= '9') {
        const idx = Number(e.key) - 1
        const tag = tags[idx]
        if (tag) { e.preventDefault(); onToggleArmed(tag.id) }
        return
      }
      if (e.key === ' ') { e.preventDefault(); onNo(); return }
      if ((e.key === 'z' || e.key === 'Z') && onUndo) { e.preventDefault(); onUndo(); return }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [tags, onToggleArmed, onNo, onUndo])
}

/** Top tag strip: all tags as chips, click to toggle "armed" state.
 *  Armed tags get applied together when the user does a Yes swipe.
 *  Plus a NewMoodInput for inline tag creation.
 *
 *  suggestedTagIds (optional): tags the HeuristicTagger flagged as
 *  matching the current card (= hashtag / domain / keyword). Rendered
 *  with a `chipSuggested` visual so the user sees "the system thinks
 *  these apply" at a glance, even before clicking. Independent of
 *  `armedTagIds` — a chip may be both suggested AND armed.
 *
 *  onChipContextMenu (optional): right-click handler. Receives the
 *  pointer position (= clientX/clientY) so the parent can mount a
 *  context menu near the chip. When supplied, the chip suppresses
 *  the native browser menu.
 *
 *  activeContextTagId (optional): id of the chip whose context menu
 *  is currently open. Rendered with a red outline halo so the user
 *  sees which chip the menu is acting on. */
export function TopTagStrip({
  tags, armedTagIds, suggestedTagIds, onToggle, onCreate, onChipContextMenu, activeContextTagId,
  showAddButton = true,
}: {
  tags: ReadonlyArray<TagRecord>
  armedTagIds: ReadonlySet<string>
  suggestedTagIds?: ReadonlySet<string>
  onToggle: (tagId: string) => void
  onCreate?: (name: string) => void
  onChipContextMenu?: (
    e: ReactMouseEvent<HTMLButtonElement>,
    tagId: string,
  ) => void
  activeContextTagId?: string | null
  /** When false, the inline "+ TAG" creator is NOT rendered inside the strip.
   *  TriagePage renders it pinned outside the scroll region so it's always
   *  visible; the default keeps the standalone behaviour for any other use. */
  showAddButton?: boolean
}): ReactElement {
  return (
    <div className={styles.tagStrip} data-testid="top-tag-strip">
      {tags.map((tag, i) => {
        const armed = armedTagIds.has(tag.id)
        const suggested = suggestedTagIds?.has(tag.id) ?? false
        const contextActive = activeContextTagId === tag.id
        const cls = [
          styles.chip,
          armed && styles.chipArmed,
          suggested && !armed && styles.chipSuggested,
          contextActive && styles.chipContextActive,
        ].filter(Boolean).join(' ')
        return (
          <button
            key={tag.id}
            type="button"
            className={cls}
            // Don't let a mouse click leave the chip focused: the triage screen
            // is keyboard-shortcut driven (1-9 arm, arrows/space act on window),
            // so a lingering mouse-focus lights up the :focus-visible ring the
            // moment the next keystroke flips the page into keyboard modality —
            // a redundant "square frame" on top of the armed green-glow state.
            // preventDefault here blocks focus-on-click only; Tab focus (and its
            // ring, for real keyboard navigation) is untouched.
            onMouseDown={(e): void => e.preventDefault()}
            onClick={(): void => onToggle(tag.id)}
            onContextMenu={(e): void => {
              if (!onChipContextMenu) return
              e.preventDefault()
              onChipContextMenu(e, tag.id)
            }}
            data-testid={`tag-chip-${tag.id}`}
            data-tag-id={tag.id}
            aria-pressed={armed}
          >
            {i < 9 && <span className={styles.chipKey}>{i + 1}</span>}
            <span className={styles.chipName}>{tag.name}</span>
            {suggested && !armed && <span className={styles.chipSparkle}>✦</span>}
          </button>
        )
      })}
      {showAddButton && onCreate && <NewMoodInput onCreate={onCreate} />}
    </div>
  )
}
