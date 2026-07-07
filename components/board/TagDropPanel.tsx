'use client'

import { type ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import type { TagRecord } from '@/lib/storage/indexeddb'
import styles from './TagDropPanel.module.css'

type Props = {
  /** User's tags, in display order. Each row is a drop target (drop wiring lands
   *  in Phase 2 — rows carry data-tag-id for the drag hit-test). */
  readonly tags: readonly TagRecord[]
  /** Count of currently-selected cards — shown so the user knows what a drop
   *  would tag. */
  readonly selectedCount: number
  /** Leave TAG MODE (also reachable via CANCEL / Esc from the parent). */
  readonly onDone: () => void
}

/** Small, tag-dedicated panel floated on the right edge and vertically centered.
 *  Lists the user's tags (drop targets) + a "+ NEW TAG" target. Caps at a
 *  reasonable height and scrolls internally once the tag list overflows — never
 *  a full-height rail. Phase 1 renders it; drag-and-drop assignment is Phase 2. */
export function TagDropPanel({ tags, selectedCount, onDone }: Props): ReactElement {
  return (
    <div className={styles.root} style={{ zIndex: BOARD_Z_INDEX.TAG_PANEL }} role="region" aria-label="Tag selected cards">
      <div className={styles.panel}>
        <div className={styles.head}>
          <span className={styles.count} data-testid="tag-mode-count">{selectedCount} SELECTED</span>
          <button type="button" className={styles.done} onClick={onDone} data-testid="tag-mode-done">DONE</button>
        </div>
        <div className={styles.list}>
          {tags.length === 0 && (
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
              {t.name}
            </div>
          ))}
          <div className={styles.newTag} data-tag-new="true" data-testid="tag-drop-new">
            + NEW TAG
          </div>
        </div>
      </div>
    </div>
  )
}
