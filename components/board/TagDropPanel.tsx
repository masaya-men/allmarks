'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import type { TagRecord } from '@/lib/storage/indexeddb'
import styles from './TagDropPanel.module.css'

type Props = {
  /** User's tags, in display order. Each row is a drop target (carries
   *  data-tag-id for the drag hit-test). */
  readonly tags: readonly TagRecord[]
  /** Count of currently-selected cards — shown so the user knows what a drop
   *  would tag. */
  readonly selectedCount: number
  /** Leave TAG MODE (also reachable via CANCEL / Esc from the parent). */
  readonly onDone: () => void
  /** Phase 3: when true, the "+ NEW TAG" row is replaced by an inline name
   *  input (opened by clicking it, or by dropping cards on it). */
  readonly creating: boolean
  /** Open the inline create input for the current selection (click path). */
  readonly onStartNewTag: () => void
  /** Commit the typed name → create the tag + assign it to the pending cards. */
  readonly onCommitNewTag: (name: string) => void
  /** Abandon the inline create input (Esc / empty blur). */
  readonly onCancelNewTag: () => void
}

/** Small, tag-dedicated panel floated on the right edge and vertically centered.
 *  Lists the user's tags (drop targets) + a "+ NEW TAG" target. Caps at a
 *  reasonable height and scrolls internally once the tag list overflows — never
 *  a full-height rail. Phase 2 wires drag-and-drop assignment (the drop hit-test
 *  lives in CardsLayer and toggles data-drop-hover on these rows); Phase 3 adds
 *  the inline create input below. */
export function TagDropPanel({
  tags,
  selectedCount,
  onDone,
  creating,
  onStartNewTag,
  onCommitNewTag,
  onCancelNewTag,
}: Props): ReactElement {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Focus the field when the create input opens; reset the draft when it closes.
  useEffect(() => {
    if (!creating) {
      setName('')
      return
    }
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return (): void => cancelAnimationFrame(id)
  }, [creating])

  const commit = (): void => {
    const trimmed = name.trim()
    if (trimmed) onCommitNewTag(trimmed)
    else onCancelNewTag()
    setName('')
  }

  return (
    <div className={styles.root} style={{ zIndex: BOARD_Z_INDEX.TAG_PANEL }} role="region" aria-label="Tag selected cards">
      <div className={styles.panel}>
        <div className={styles.head}>
          <span className={styles.count} data-testid="tag-mode-count">{selectedCount} SELECTED</span>
          <button type="button" className={styles.done} onClick={onDone} data-testid="tag-mode-done">DONE</button>
        </div>
        <div className={styles.hint}>Drag cards onto a tag →</div>
        <div className={styles.list}>
          {tags.length === 0 && !creating && (
            <div className={styles.empty}>No tags yet — drop on “+ NEW TAG” to make one.</div>
          )}
          {tags.map((t) => (
            <div
              key={t.id}
              className={styles.tagRow}
              data-tag-id={t.id}
              data-testid={`tag-drop-${t.id}`}
              title={t.name}
            >
              <span className={styles.swatch} style={{ background: t.color }} aria-hidden="true" />
              <span className={styles.tagName}>{t.name}</span>
            </div>
          ))}
          {creating ? (
            <input
              ref={inputRef}
              className={styles.newInput}
              value={name}
              onChange={(e): void => setName(e.target.value)}
              onBlur={commit}
              onKeyDown={(e): void => {
                if (e.key === 'Enter') { e.preventDefault(); commit() }
                if (e.key === 'Escape') { e.preventDefault(); setName(''); onCancelNewTag() }
              }}
              placeholder="TAG NAME"
              data-testid="tag-new-input"
            />
          ) : (
            <button
              type="button"
              className={styles.newTag}
              data-tag-new="true"
              data-testid="tag-drop-new"
              onClick={onStartNewTag}
            >
              + NEW TAG
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
