'use client'

import { useEffect, useRef, type MouseEvent as ReactMouseEvent, type ReactElement } from 'react'
import type { TagRecord } from '@/lib/storage/indexeddb'
import { useDragReorder } from '@/lib/board/use-drag-reorder'
import { InlineTagRenameInput } from '@/components/board/InlineTagRenameInput'
import { NewTagInput } from './NewTagInput'
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
 *  Plus a NewTagInput for inline tag creation.
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
  showAddButton = true, onReorder, editingTagId, onRenameSubmit, onRenameCancel,
  cardDragActive = false, dropTargetTagId = null,
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
  /** True while a card is being carried over the strip (drag-to-tag). Dims the
   *  chips so the targeted one stands out. */
  cardDragActive?: boolean
  /** Id of the chip the carried card is currently aimed at — blooms big+green. */
  dropTargetTagId?: string | null
  /** When false, the inline "+ TAG" creator is NOT rendered inside the strip.
   *  TriagePage renders it pinned outside the scroll region so it's always
   *  visible; the default keeps the standalone behaviour for any other use. */
  showAddButton?: boolean
  /** Persist a new complete tag order (drag-to-reorder via the chip grip).
   *  When omitted, the grip handles are not rendered. Same single `order`
   *  field as the filter dropdown, so reordering here reflects everywhere. */
  onReorder?: (orderedIds: string[]) => void
  /** Id of the chip currently being renamed in place. The matching chip swaps
   *  its name for a text input; null = no inline edit in progress. */
  editingTagId?: string | null
  /** Commit an inline rename (trimmed new name). */
  onRenameSubmit?: (tagId: string, name: string) => void
  /** Abandon the inline rename (Esc / invalid blur). */
  onRenameCancel?: () => void
}): ReactElement {
  /* Horizontal drag-to-reorder (direct, handle-less). Press a chip and move
     past a small threshold to reorder it; a press that doesn't move stays a
     toggle/arm. Pointer near the left/right edge auto-scrolls the strip so
     off-screen chips are reachable — which (with the dragged-chip-excluded
     hit-test in the shared hook) is what makes RIGHTWARD reordering work. */
  const stripRef = useRef<HTMLDivElement | null>(null)
  const dr = useDragReorder({
    axis: 'x',
    ids: tags.map((t) => t.id),
    onReorder,
    // The scroll container is the strip's parent (the overflow-x region that
    // TriagePage owns); items live in the strip itself.
    getScrollEl: () => stripRef.current?.parentElement ?? null,
    getItemsEl: () => stripRef.current,
  })
  const drag = dr.drag

  return (
    <div className={styles.tagStrip} data-testid="top-tag-strip" ref={stripRef}>
      {tags.map((tag, i) => {
        const armed = armedTagIds.has(tag.id)
        const suggested = suggestedTagIds?.has(tag.id) ?? false
        const contextActive = activeContextTagId === tag.id
        const isEditing = editingTagId === tag.id
        const isDragging = drag?.id === tag.id
        const dropBefore = drag != null && !isDragging && drag.gapIndex === i
        const dropAfter = drag != null && !isDragging && drag.gapIndex >= tags.length && i === tags.length - 1
        const isDropTarget = cardDragActive && dropTargetTagId === tag.id
        const isDragDimmed = cardDragActive && !isDropTarget
        const cls = [
          styles.chip,
          armed && styles.chipArmed,
          suggested && !armed && styles.chipSuggested,
          contextActive && styles.chipContextActive,
          isDropTarget && styles.chipDropTarget,
          isDragDimmed && styles.chipDragDimmed,
        ].filter(Boolean).join(' ')
        return (
          <button
            key={tag.id}
            type="button"
            className={cls}
            data-dragging={isDragging ? 'true' : undefined}
            data-drop-before={dropBefore ? 'true' : undefined}
            data-drop-after={dropAfter ? 'true' : undefined}
            style={isDragging && drag ? { transform: `translateX(${drag.offset}px)`, zIndex: 3 } : undefined}
            // Don't let a mouse click leave the chip focused: the triage screen
            // is keyboard-shortcut driven (1-9 arm, arrows/space act on window),
            // so a lingering mouse-focus lights up the :focus-visible ring the
            // moment the next keystroke flips the page into keyboard modality —
            // a redundant "square frame" on top of the armed green-glow state.
            // preventDefault here blocks focus-on-click only; Tab focus (and its
            // ring, for real keyboard navigation) is untouched.
            onMouseDown={(e): void => e.preventDefault()}
            onPointerDown={(e): void => { if (!isEditing) dr.onItemPointerDown(tag.id, e) }}
            onClick={(): void => {
              if (dr.shouldSuppressClick()) return
              if (!isEditing) onToggle(tag.id)
            }}
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
            {isEditing && onRenameSubmit && onRenameCancel ? (
              <InlineTagRenameInput
                className={styles.chipRenameInput}
                duplicateClassName={styles.chipRenameInputDuplicate}
                currentName={tag.name}
                otherNames={tags.filter((t) => t.id !== tag.id).map((t) => t.name)}
                onSubmit={(name): void => onRenameSubmit(tag.id, name)}
                onCancel={onRenameCancel}
                data-testid={`tag-chip-rename-input-${tag.id}`}
              />
            ) : (
              <>
                <span className={styles.chipName}>{tag.name}</span>
                {suggested && !armed && <span className={styles.chipSparkle}>✦</span>}
              </>
            )}
          </button>
        )
      })}
      {showAddButton && onCreate && <NewTagInput onCreate={onCreate} />}
    </div>
  )
}
