'use client'

import { useEffect, type ReactElement } from 'react'
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
 *  Plus a NewMoodInput for inline tag creation. */
export function TopTagStrip({
  tags, armedTagIds, onToggle, onCreate,
}: {
  tags: ReadonlyArray<TagRecord>
  armedTagIds: ReadonlySet<string>
  onToggle: (tagId: string) => void
  onCreate: (name: string) => void
}): ReactElement {
  return (
    <div className={styles.tagStrip} data-testid="top-tag-strip">
      {tags.map((tag, i) => {
        const armed = armedTagIds.has(tag.id)
        return (
          <button
            key={tag.id}
            type="button"
            className={`${styles.chip} ${armed ? styles.chipArmed : ''}`.trim()}
            onClick={(): void => onToggle(tag.id)}
            data-testid={`tag-chip-${tag.id}`}
            aria-pressed={armed}
          >
            {i < 9 && <span className={styles.chipKey}>{i + 1}</span>}
            <span className={styles.chipDot} style={{ background: tag.color }} />
            <span className={styles.chipName}>{tag.name}</span>
            {armed && <span className={styles.chipCheck}>✓</span>}
          </button>
        )
      })}
      <NewMoodInput onCreate={onCreate} />
    </div>
  )
}
