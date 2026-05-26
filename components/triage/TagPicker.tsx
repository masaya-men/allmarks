'use client'

import { useEffect, type ReactElement } from 'react'
import type { TagRecord } from '@/lib/storage/indexeddb'
import { t } from '@/lib/i18n/t'
import { NewMoodInput } from './NewMoodInput'
import styles from './TagPicker.module.css'

export type Direction = 'up' | 'right' | 'down' | 'left'

/** Keyboard handler hook for the 1-9 co-tag toggle, Space skip, Z undo.
 *  Direction keys (Arrow / WASD) are handled in TriagePage itself
 *  alongside Esc. Skips input/textarea targets. */
export function useTagPickerKeys({
  tags, onToggleCoTag, onSkip, onUndo,
}: {
  tags: ReadonlyArray<TagRecord>
  onToggleCoTag: (tagId: string) => void
  onSkip: () => void
  onUndo: (() => void) | null
}): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.key >= '1' && e.key <= '9') {
        const idx = Number(e.key) - 1
        const tag = tags[idx]
        if (tag) { e.preventDefault(); onToggleCoTag(tag.id) }
        return
      }
      if (e.key === ' ') { e.preventDefault(); onSkip(); return }
      if ((e.key === 'z' || e.key === 'Z') && onUndo) { e.preventDefault(); onUndo(); return }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [tags, onToggleCoTag, onSkip, onUndo])
}

/** Direction chip used in the 4 edge strips. Stacks the active tag on
 *  top with the Shift-flipped sub tag faint below. */
export function DirChip({
  primary, secondary, shifted, arrow, keyLabel, coTagIds, suggestedSet, onSwipe,
}: {
  primary: TagRecord | undefined
  secondary: TagRecord | undefined
  shifted: boolean
  arrow: string
  keyLabel: string
  coTagIds: ReadonlySet<string>
  suggestedSet: ReadonlySet<string>
  onSwipe: () => void
}): ReactElement | null {
  const activeTag = shifted ? (secondary ?? primary) : (primary ?? secondary)
  const subTag = shifted ? primary : secondary
  if (!activeTag) return null
  const activeIsCo = coTagIds.has(activeTag.id)
  const activeIsSuggested = suggestedSet.has(activeTag.id)
  return (
    <button
      type="button"
      className={`${styles.dirChip} ${activeIsSuggested ? styles.suggested : ''} ${activeIsCo ? styles.coOn : ''}`.trim()}
      onClick={onSwipe}
      data-testid={`dir-chip-${activeTag.id}`}
    >
      <span className={styles.dirHint}>
        <span className={styles.dirArrow}>{arrow}</span>
        <span className={styles.dirKey}>{keyLabel}</span>
      </span>
      <span className={styles.dirActive}>
        <span className={styles.dirDot} style={{ background: activeTag.color }} />
        <span className={styles.dirName}>{activeTag.name}</span>
      </span>
      {subTag && (
        <span className={styles.dirSub}>
          <span className={styles.dirSubDot} style={{ background: subTag.color }} />
          <span className={styles.dirSubName}>{subTag.name}</span>
        </span>
      )}
    </button>
  )
}

/** Co-tag strip: chips for every tag, toggle co-add, plus skip/undo
 *  buttons and the Shift hint. Rendered inside the canvas, below the
 *  TriageCard. */
export function CoTagStrip({
  tags, coTagIds, suggestedSet, onToggle, onCreate, onSkip, onUndo,
}: {
  tags: ReadonlyArray<TagRecord>
  coTagIds: ReadonlySet<string>
  suggestedSet: ReadonlySet<string>
  onToggle: (tagId: string) => void
  onCreate: (name: string) => void
  onSkip: () => void
  onUndo: (() => void) | null
}): ReactElement {
  return (
    <div className={styles.coStrip}>
      <div className={styles.coChips}>
        {tags.map((tag, i) => {
          const on = coTagIds.has(tag.id)
          const sug = suggestedSet.has(tag.id)
          return (
            <button
              key={tag.id}
              type="button"
              className={`${styles.coChip} ${on ? styles.coChipOn : ''} ${sug ? styles.coChipSuggested : ''}`.trim()}
              onClick={(): void => onToggle(tag.id)}
              data-testid={`co-chip-${tag.id}`}
              aria-pressed={on}
            >
              {i < 9 && <span className={styles.coDigit}>{i + 1}</span>}
              <span className={styles.coDot} style={{ background: tag.color }} />
              <span className={styles.coName}>{tag.name}</span>
              {on && <span className={styles.coCheck}>✓</span>}
            </button>
          )
        })}
        <NewMoodInput onCreate={onCreate} />
      </div>
      <div className={styles.utilRow}>
        <button type="button" className={styles.util} onClick={onSkip}>
          {t('triage.skip')} <span className={styles.utilHint}>Space</span>
        </button>
        {onUndo && (
          <button type="button" className={styles.util} onClick={onUndo}>
            {t('triage.undo')} <span className={styles.utilHint}>Z</span>
          </button>
        )}
        <span className={styles.coHint}>Shift = 5-8 切替</span>
      </div>
    </div>
  )
}
