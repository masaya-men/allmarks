'use client'

import { useEffect, useMemo, type ReactElement } from 'react'
import type { TagRecord } from '@/lib/storage/indexeddb'
import { t } from '@/lib/i18n/t'
import { NewMoodInput } from './NewMoodInput'
import styles from './TagPicker.module.css'

type Direction = 'up' | 'right' | 'down' | 'left'

type Props = {
  readonly tags: ReadonlyArray<TagRecord>
  readonly onTag: (tagId: string) => void
  readonly onSkip: () => void
  readonly onUndo: (() => void) | null
  readonly onCreateTag: (name: string) => void
  readonly suggestedTagIds?: ReadonlyArray<string>
}

/**
 * Phase A directional MVP (= session 72).
 * First 4 tags map to up / right / down / left. Arrow keys + chip click both
 * fire onTag. Number keys 1-9 keep the existing fast-select. S = skip,
 * Z = undo (= existing). Number suffix in each chip hint mirrors the
 * digit-key fallback so the user sees both input paths.
 *
 * Phase B (= next session) will add Shift-to-flip secondary tags 5-8, plus
 * multi-tag toggle (= chip + digit + text input simultaneously selectable).
 */
export function TagPicker({ tags, onTag, onSkip, onUndo, onCreateTag, suggestedTagIds }: Props): ReactElement {
  const directional = useMemo<Record<Direction, TagRecord | undefined>>(() => ({
    up: tags[0],
    right: tags[1],
    down: tags[2],
    left: tags[3],
  }), [tags])

  // Arrow keys + Esc are owned by TriagePage (= it wraps swipe with animation).
  // TagPicker only handles the no-animation fast paths: number digits, S, Z.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      if (e.key >= '1' && e.key <= '9') {
        const idx = Number(e.key) - 1
        const tag = tags[idx]
        if (tag) { e.preventDefault(); onTag(tag.id) }
        return
      }

      if (e.key === 's' || e.key === 'S') { e.preventDefault(); onSkip(); return }
      if ((e.key === 'z' || e.key === 'Z') && onUndo) { e.preventDefault(); onUndo(); return }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [tags, onTag, onSkip, onUndo])

  return (
    <div className={styles.directionalRoot} data-testid="tag-picker">
      <div className={`${styles.slot} ${styles.slotUp}`}>
        {directional.up && (
          <DirChip
            tag={directional.up}
            arrow="↑"
            digit={1}
            suggested={(suggestedTagIds ?? []).includes(directional.up.id)}
            onClick={onTag}
          />
        )}
      </div>
      <div className={`${styles.slot} ${styles.slotRight}`}>
        {directional.right && (
          <DirChip
            tag={directional.right}
            arrow="→"
            digit={2}
            suggested={(suggestedTagIds ?? []).includes(directional.right.id)}
            onClick={onTag}
          />
        )}
      </div>
      <div className={`${styles.slot} ${styles.slotDown}`}>
        {directional.down && (
          <DirChip
            tag={directional.down}
            arrow="↓"
            digit={3}
            suggested={(suggestedTagIds ?? []).includes(directional.down.id)}
            onClick={onTag}
          />
        )}
      </div>
      <div className={`${styles.slot} ${styles.slotLeft}`}>
        {directional.left && (
          <DirChip
            tag={directional.left}
            arrow="←"
            digit={4}
            suggested={(suggestedTagIds ?? []).includes(directional.left.id)}
            onClick={onTag}
          />
        )}
      </div>
      <div className={styles.utilRow}>
        <NewMoodInput onCreate={onCreateTag} />
        <button type="button" className={styles.util} onClick={onSkip}>
          {t('triage.skip')} <span className={styles.utilHint}>S</span>
        </button>
        {onUndo && (
          <button type="button" className={styles.util} onClick={onUndo}>
            {t('triage.undo')} <span className={styles.utilHint}>Z</span>
          </button>
        )}
      </div>
    </div>
  )
}

function DirChip({ tag, arrow, digit, suggested, onClick }: {
  tag: TagRecord
  arrow: string
  digit: number
  suggested: boolean
  onClick: (tagId: string) => void
}): ReactElement {
  return (
    <button
      type="button"
      className={`${styles.dirChip} ${suggested ? styles.suggested : ''}`.trim()}
      onClick={() => onClick(tag.id)}
      data-testid={`dir-chip-${tag.id}`}
    >
      <span className={styles.dirHint}>{arrow} {digit}</span>
      <span className={styles.dirDot} style={{ background: tag.color }} />
      <span className={styles.dirName}>{tag.name}</span>
    </button>
  )
}
