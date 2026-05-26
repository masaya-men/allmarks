'use client'

import { useEffect, type ReactElement } from 'react'
import type { TagRecord } from '@/lib/storage/indexeddb'
import { t } from '@/lib/i18n/t'
import { NewMoodInput } from './NewMoodInput'
import styles from './TagPicker.module.css'

type Direction = 'up' | 'right' | 'down' | 'left'

type Props = {
  readonly tags: ReadonlyArray<TagRecord>
  /** First 4 tags map to up/right/down/left as primary slots. */
  readonly primaryDirectional: Record<Direction, TagRecord | undefined>
  /** Tags 5-8 (= tags[4..7]) map to up/right/down/left as secondary slots,
   *  shown faintly under the primary chip and revealed (= swapped to front)
   *  while Shift is held. */
  readonly secondaryDirectional: Record<Direction, TagRecord | undefined>
  readonly shiftHeld: boolean
  /** Which tags are currently toggled as co-tags. Swipe persists main +
   *  co-tags together. Toggle via chip click, digit keys 1-9, or new-tag
   *  input field. */
  readonly coTagIds: ReadonlySet<string>
  /** Fired when user picks a direction (= arrow key already handled in
   *  TriagePage; here it's chip click). TriagePage computes the actual
   *  tag from shiftHeld + direction. */
  readonly onDirectionSwipe: (dir: Direction) => void
  readonly onToggleCoTag: (tagId: string) => void
  readonly onSkip: () => void
  readonly onUndo: (() => void) | null
  readonly onCreateTagAddToCo: (name: string) => void
  readonly suggestedTagIds?: ReadonlyArray<string>
}

export function TagPicker({
  tags,
  primaryDirectional,
  secondaryDirectional,
  shiftHeld,
  coTagIds,
  onDirectionSwipe,
  onToggleCoTag,
  onSkip,
  onUndo,
  onCreateTagAddToCo,
  suggestedTagIds,
}: Props): ReactElement {
  // Number keys 1-9 toggle co-tags (= Phase B1 changed from instant-persist
  // to multi-toggle). 1 = tags[0], 9 = tags[8]. Swipe applies them all.
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

  const suggestedSet = new Set(suggestedTagIds ?? [])

  return (
    <div className={styles.directionalRoot} data-testid="tag-picker" data-shift={shiftHeld ? 'true' : 'false'}>
      <div className={`${styles.slot} ${styles.slotUp}`}>
        <DirChip
          primary={primaryDirectional.up}
          secondary={secondaryDirectional.up}
          shifted={shiftHeld}
          arrow="↑"
          keyLabel="W"
          coTagIds={coTagIds}
          suggestedSet={suggestedSet}
          onSwipe={(): void => onDirectionSwipe('up')}
        />
      </div>
      <div className={`${styles.slot} ${styles.slotRight}`}>
        <DirChip
          primary={primaryDirectional.right}
          secondary={secondaryDirectional.right}
          shifted={shiftHeld}
          arrow="→"
          keyLabel="D"
          coTagIds={coTagIds}
          suggestedSet={suggestedSet}
          onSwipe={(): void => onDirectionSwipe('right')}
        />
      </div>
      <div className={`${styles.slot} ${styles.slotDown}`}>
        <DirChip
          primary={primaryDirectional.down}
          secondary={secondaryDirectional.down}
          shifted={shiftHeld}
          arrow="↓"
          keyLabel="S"
          coTagIds={coTagIds}
          suggestedSet={suggestedSet}
          onSwipe={(): void => onDirectionSwipe('down')}
        />
      </div>
      <div className={`${styles.slot} ${styles.slotLeft}`}>
        <DirChip
          primary={primaryDirectional.left}
          secondary={secondaryDirectional.left}
          shifted={shiftHeld}
          arrow="←"
          keyLabel="A"
          coTagIds={coTagIds}
          suggestedSet={suggestedSet}
          onSwipe={(): void => onDirectionSwipe('left')}
        />
      </div>
      <CoTagStrip
        tags={tags}
        coTagIds={coTagIds}
        suggestedSet={suggestedSet}
        onToggle={onToggleCoTag}
        onCreate={onCreateTagAddToCo}
        onSkip={onSkip}
        onUndo={onUndo}
      />
    </div>
  )
}

function DirChip({
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
  // Which tag is the "active" (= will be applied on swipe)?
  const activeTag = shifted ? (secondary ?? primary) : (primary ?? secondary)
  const subTag = shifted ? primary : secondary
  if (!activeTag) return null // nothing to assign in this direction

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

function CoTagStrip({
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
