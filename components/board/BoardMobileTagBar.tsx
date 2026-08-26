'use client'

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import { useRollingCount } from '@/lib/board/use-rolling-count'
import type { TagRecord } from '@/lib/storage/indexeddb'
import { PRIVATE_LOCKED_ICON, PRIVATE_UNLOCKED_ICON, PRIVATE_LABEL } from '@/lib/private/ui-labels'
import styles from './BoardMobileTagBar.module.css'

type Props = {
  /** User's tags, in display order. Rendered as a horizontal, left-right
   *  scrolling strip of chips — tap one to apply it to the selected cards. */
  readonly tags: readonly TagRecord[]
  /** Per-tag bookmark count (3-digit readout), matching the FilterPill vocab. */
  readonly tagCounts: Readonly<Record<string, number>>
  /** How many cards are currently selected — a tap tags all of them. */
  readonly selectedCount: number
  /** Apply an existing tag to the current selection (no-op when count is 0). */
  readonly onAssignTag: (tagId: string) => void
  /** Leave TAG MODE. */
  readonly onDone: () => void
  /** True while the inline "+ NEW TAG" name field is open. */
  readonly creating: boolean
  readonly onStartNewTag: () => void
  readonly onCommitNewTag: (name: string) => void
  readonly onCancelNewTag: () => void
  /** 3-state Private status — drives the pinned chip's tone. */
  readonly privateStatus: 'none' | 'locked' | 'unlocked'
  /** Tap the Private chip. No-op when nothing is selected (mirrors onAssignTag). */
  readonly onPrivateTap: () => void
}

/** Mobile TAG MODE bar (session 182). The desktop tags by DRAGGING cards onto a
 *  right-edge panel; touch can't (drag = board scroll), so mobile taps instead:
 *  select cards, then tap a tag in this bottom strip to apply it to the whole
 *  selection. Sits at the viewport floor in place of BoardMobileNav while
 *  tagging. FilterPill vocab (mono, hollow dot, lowercase, 3-digit count) — no
 *  capsules. Rendered only on mobile (BoardRoot gates on useIsMobile). */
export function BoardMobileTagBar({
  tags,
  tagCounts,
  selectedCount,
  onAssignTag,
  onDone,
  creating,
  onStartNewTag,
  onCommitNewTag,
  onCancelNewTag,
  privateStatus,
  onPrivateTap,
}: Props): ReactElement {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const hasSelection = selectedCount > 0

  // Brief green flash on the tapped chip so a tap reads as "applied" even when
  // the count doesn't visibly move (e.g. re-tagging already-tagged cards).
  const [flashId, setFlashId] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => (): void => { if (flashTimer.current) clearTimeout(flashTimer.current) }, [])

  const handleTap = useCallback((tagId: string): void => {
    if (!hasSelection) return
    onAssignTag(tagId)
    setFlashId(tagId)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlashId(null), 420)
  }, [hasSelection, onAssignTag])

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
    <div
      className={styles.bar}
      style={{ zIndex: BOARD_Z_INDEX.TAG_PANEL }}
      role="region"
      aria-label="Tag selected cards"
      data-tag-panel="true"
      data-testid="mobile-tag-bar"
    >
      <div className={styles.header}>
        <span className={styles.count} data-testid="mobile-tag-count">
          {hasSelection ? `${selectedCount} SELECTED` : 'TAP CARDS TO SELECT'}
        </span>
        <button type="button" className={styles.done} onClick={onDone} data-testid="mobile-tag-done">
          DONE
        </button>
      </div>

      <div className={styles.strip} data-tag-scroll="true">
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
            data-testid="mobile-tag-new-input"
          />
        ) : (
          <button
            type="button"
            className={styles.newChip}
            onClick={onStartNewTag}
            data-testid="mobile-tag-new"
          >
            <span className={styles.plus} aria-hidden="true">+</span>
            <span className={styles.newLabel}>NEW TAG</span>
          </button>
        )}

        {tags.map((t) => (
          <TagChip
            key={t.id}
            tag={t}
            count={tagCounts[t.id] ?? 0}
            applied={flashId === t.id}
            disabled={!hasSelection}
            onTap={handleTap}
          />
        ))}

        <button
          type="button"
          className={styles.chip}
          data-private-status={privateStatus}
          aria-disabled={!hasSelection}
          onClick={onPrivateTap}
          data-testid="mobile-tag-private"
          title="Private"
        >
          <span className={styles.tagDot} aria-hidden="true" />
          <span className={styles.tagLabel}>
            {privateStatus === 'unlocked' ? PRIVATE_UNLOCKED_ICON : PRIVATE_LOCKED_ICON}{PRIVATE_LABEL}
          </span>
        </button>
      </div>
    </div>
  )
}

type TagChipProps = {
  readonly tag: TagRecord
  readonly count: number
  /** True for ~420ms right after this chip was tapped. */
  readonly applied: boolean
  readonly disabled: boolean
  readonly onTap: (tagId: string) => void
}

/** One tag chip. Its own component (not inlined in the .map) so the count's
 *  roll-up hook — which must run every render regardless of whether count
 *  changed — is scoped to just this chip instead of firing for every tag
 *  whenever any single chip's count changes. */
function TagChip({ tag, count, applied, disabled, onTap }: TagChipProps): ReactElement {
  const displayCount = useRollingCount(count)
  return (
    <button
      type="button"
      className={styles.chip}
      data-applied={applied ? 'true' : 'false'}
      aria-disabled={disabled}
      onClick={(): void => onTap(tag.id)}
      data-testid={`mobile-tag-${tag.id}`}
      title={tag.name}
    >
      <span className={styles.tagDot} aria-hidden="true" />
      <span className={styles.tagLabel}>{tag.name}</span>
      <span className={styles.tagCount}>{String(displayCount).padStart(3, '0')}</span>
    </button>
  )
}
