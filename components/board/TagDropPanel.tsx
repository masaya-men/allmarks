'use client'

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import { computeTagScrollEdge } from '@/lib/board/tag-scroll-edge'
import { useRollingCount } from '@/lib/board/use-rolling-count'
import type { TagRecord } from '@/lib/storage/indexeddb'
import { PRIVATE_DROP_KEY } from '@/lib/private/apply-tag-change'
import { PRIVATE_LOCKED_ICON, PRIVATE_UNLOCKED_ICON, PRIVATE_LABEL } from '@/lib/private/ui-labels'
import styles from './TagDropPanel.module.css'

type Props = {
  /** User's tags, in display order. Each row is a drop target (carries
   *  data-tag-id for the drag hit-test). */
  readonly tags: readonly TagRecord[]
  /** Per-tag bookmark count, keyed by tag id — shown as the 3-digit readout on
   *  each row, matching the FilterPill dropdown. */
  readonly tagCounts: Readonly<Record<string, number>>
  /** Count of currently-selected cards — shown so the user knows what a drop
   *  (or click — see onAssignTag) would tag. */
  readonly selectedCount: number
  /** Click a tag row: apply it to the whole current selection. No-op when
   *  selectedCount is 0. Mirrors BoardMobileTagBar's tap-to-apply — the
   *  desktop panel used to be drag-and-drop only (N-72). */
  readonly onAssignTag: (tagId: string) => void
  /** Click the pinned Private row (mirrors onAssignTag). */
  readonly onPrivateTap: () => void
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
  /** 3-state Private status — drives the pinned Private row's tone. */
  readonly privateStatus: 'none' | 'locked' | 'unlocked'
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
  onAssignTag,
  onPrivateTap,
  onDone,
  creating,
  onStartNewTag,
  onCommitNewTag,
  onCancelNewTag,
  privateStatus,
}: Props): ReactElement {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const [scrollEdge, setScrollEdge] = useState<'none' | 'top' | 'middle' | 'bottom'>('none')
  const hasSelection = selectedCount > 0

  // Click-to-apply confirmation flash — reuses the existing drag-drop flash
  // CSS (data-dropped, ~420ms) so click and drag land the same way.
  const [flashId, setFlashId] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleRowClick = useCallback((tagId: string): void => {
    if (!hasSelection) return
    onAssignTag(tagId)
    setFlashId(tagId)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlashId(null), 420)
  }, [hasSelection, onAssignTag])
  useEffect(() => {
    return (): void => {
      if (flashTimer.current) clearTimeout(flashTimer.current)
    }
  }, [])

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
            <TagRow
              key={t.id}
              tag={t}
              count={tagCounts[t.id] ?? 0}
              flashed={flashId === t.id}
              disabled={!hasSelection}
              onClick={handleRowClick}
            />
          ))}
          {/* Private — always the LAST row inside the scrolling list (sibling
              of the mapped tag rows above), so it sinks below the fold as the
              real tag count grows instead of staying pinned in a fixed spot.
              Still hit-tested the same way as any other [data-tag-id] drop
              target (CardsLayer's drag hit-test is a live
              document.elementFromPoint lookup, unaffected by which container
              this row lives in or its current scroll position). */}
          <button
            type="button"
            className={styles.tagItem}
            data-tag-id={PRIVATE_DROP_KEY}
            data-private-status={privateStatus}
            data-dropped={flashId === PRIVATE_DROP_KEY ? 'true' : undefined}
            aria-disabled={!hasSelection}
            data-testid="tag-drop-private"
            title="Private"
            onClick={(): void => {
              if (!hasSelection) return
              onPrivateTap()
              setFlashId(PRIVATE_DROP_KEY)
              if (flashTimer.current) clearTimeout(flashTimer.current)
              flashTimer.current = setTimeout(() => setFlashId(null), 420)
            }}
          >
            <span className={styles.tagDot} aria-hidden="true" />
            <span className={styles.privateIcon} aria-hidden="true">
              {privateStatus === 'unlocked' ? PRIVATE_UNLOCKED_ICON : PRIVATE_LOCKED_ICON}
            </span>
            <span className={styles.tagLabel}>{PRIVATE_LABEL}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

type TagRowProps = {
  readonly tag: TagRecord
  readonly count: number
  /** True for ~420ms right after this row was clicked/dropped on. */
  readonly flashed: boolean
  /** True when there's no selection — the row is still a valid drop target
   *  (drag always carries its own cards), just not click-actionable. */
  readonly disabled: boolean
  readonly onClick: (tagId: string) => void
}

/** One tag row. Its own component (not inlined in the .map) so the count's
 *  roll-up hook — which must run every render regardless of whether count
 *  changed — is scoped to just this row instead of firing for every tag
 *  whenever any single row's count changes. */
function TagRow({ tag, count, flashed, disabled, onClick }: TagRowProps): ReactElement {
  const displayCount = useRollingCount(count)
  return (
    <button
      type="button"
      className={styles.tagItem}
      data-tag-id={tag.id}
      data-dropped={flashed ? 'true' : undefined}
      aria-disabled={disabled}
      data-testid={`tag-drop-${tag.id}`}
      title={tag.name}
      onClick={(): void => onClick(tag.id)}
    >
      <span className={styles.tagDot} aria-hidden="true" />
      <span className={styles.tagLabel}>{tag.name}</span>
      <span className={styles.tagCount}>{String(displayCount).padStart(3, '0')}</span>
    </button>
  )
}
