'use client'

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import { computeTagScrollEdge } from '@/lib/board/tag-scroll-edge'
import type { TagRecord } from '@/lib/storage/indexeddb'
import styles from './TagDropPanel.module.css'

type Props = {
  /** User's tags, in display order. Each row is a drop target (carries
   *  data-tag-id for the drag hit-test). */
  readonly tags: readonly TagRecord[]
  /** Per-tag bookmark count, keyed by tag id — shown as the 3-digit readout on
   *  each row, matching the FilterPill dropdown. */
  readonly tagCounts: Readonly<Record<string, number>>
  /** Count of currently-selected cards — shown so the user knows what a drop
   *  would tag. */
  readonly selectedCount: number
  /** Leave TAG MODE (also reachable via CANCEL / Esc from the parent). */
  readonly onDone: () => void
  /** Phase 3: when true, the pinned "+ NEW TAG" row becomes an inline name
   *  input (opened by clicking it, or by dropping cards on it). */
  readonly creating: boolean
  /** Open the inline create input for the current selection (click path). */
  readonly onStartNewTag: () => void
  /** Commit the typed name → create the tag + assign it to the pending cards. */
  readonly onCommitNewTag: (name: string) => void
  /** Abandon the inline create input (Esc / empty blur). */
  readonly onCancelNewTag: () => void
}

/** Right-edge tag panel for TAG MODE. Styled as the FilterPill dropdown's twin
 *  (editorial monospace, hollow tag dot + lowercase name + 3-digit count) so it
 *  reads as the same family as the rest of AllMarks' chrome — NOT a set of
 *  candy capsules. "+ NEW TAG" is pinned at the top; the tag list scrolls in the
 *  middle with a top/bottom fade. The card-drag hit-test (in CardsLayer) toggles
 *  data-drop-hover on these rows for the drop highlight + "+N". */
export function TagDropPanel({
  tags,
  tagCounts,
  selectedCount,
  onDone,
  creating,
  onStartNewTag,
  onCommitNewTag,
  onCancelNewTag,
}: Props): ReactElement {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const [scrollEdge, setScrollEdge] = useState<'none' | 'top' | 'middle' | 'bottom'>('none')

  const updateScroll = useCallback((): void => {
    const el = listRef.current
    if (!el) { setScrollEdge('none'); return }
    setScrollEdge(computeTagScrollEdge({
      scrollHeight: el.scrollHeight,
      scrollTop: el.scrollTop,
      clientHeight: el.clientHeight,
      maxHeight: parseFloat(getComputedStyle(el).maxHeight),
    }))
  }, [])

  // Re-measure the fade whenever the tag set changes (and once on mount).
  useEffect(() => {
    updateScroll()
    const raf = requestAnimationFrame(updateScroll)
    const el = listRef.current
    const ro = el ? new ResizeObserver(updateScroll) : null
    if (el && ro) ro.observe(el)
    return (): void => { cancelAnimationFrame(raf); ro?.disconnect() }
  }, [tags, updateScroll])

  // Focus the field when the create input opens; reset the draft when it closes.
  useEffect(() => {
    if (!creating) { setName(''); return }
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
    <div className={styles.root} style={{ zIndex: BOARD_Z_INDEX.TAG_PANEL }} role="region" aria-label="Tag selected cards" data-tag-panel="true">
      <div className={styles.menu}>
        <div className={styles.header}>
          <span className={styles.count} data-testid="tag-mode-count">{selectedCount} SELECTED</span>
          <button type="button" className={styles.done} onClick={onDone} data-testid="tag-mode-done">DONE</button>
        </div>

        {/* Pinned create row — top of the panel (matches the "ALL pinned on top"
            pattern of the FilterPill dropdown). */}
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
            className={styles.newRow}
            data-tag-new="true"
            data-testid="tag-drop-new"
            onClick={onStartNewTag}
          >
            <span className={styles.plus} aria-hidden="true">+</span>
            <span className={styles.newLabel}>NEW TAG</span>
          </button>
        )}

        <div className={styles.sectionHead}>DRAG ONTO A TAG →</div>

        <div
          ref={listRef}
          className={styles.list}
          data-tag-scroll="true"
          data-scroll-edge={scrollEdge}
          onScroll={updateScroll}
        >
          {tags.length === 0 && !creating && (
            <div className={styles.empty}>No tags yet — drop on “+ NEW TAG” to make one.</div>
          )}
          {tags.map((t) => (
            <div
              key={t.id}
              className={styles.tagItem}
              data-tag-id={t.id}
              data-testid={`tag-drop-${t.id}`}
              title={t.name}
            >
              <span className={styles.tagDot} aria-hidden="true" />
              <span className={styles.tagLabel}>{t.name}</span>
              <span className={styles.tagCount}>{String(tagCounts[t.id] ?? 0).padStart(3, '0')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
