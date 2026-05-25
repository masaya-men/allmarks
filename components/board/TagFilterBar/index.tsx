'use client'
import type { TagRecord } from '@/lib/storage/indexeddb'
import type { FilterMode } from '@/lib/storage/tags'
import styles from './TagFilterBar.module.css'

export interface TagFilterBarProps {
  tags: readonly TagRecord[]
  selectedTagIds: readonly string[]
  mode: FilterMode
  onToggle: (tagId: string) => void
  onModeChange: (mode: FilterMode) => void
  onClearAll: () => void
  totalCount: number
  matchCount: number
}

export function TagFilterBar({
  tags, selectedTagIds, mode, onToggle, onModeChange, onClearAll, totalCount, matchCount,
}: TagFilterBarProps): React.ReactNode {
  if (tags.length === 0) return null
  const isActive = selectedTagIds.length > 0

  return (
    <div className={styles.bar}>
      <div className={styles.chipScroll}>
        {tags.map((t) => {
          const selected = selectedTagIds.includes(t.id)
          return (
            <button
              key={t.id}
              type="button"
              className={styles.chip}
              data-selected={selected ? 'true' : 'false'}
              onClick={() => onToggle(t.id)}
            >
              {t.name}
            </button>
          )
        })}
      </div>
      {isActive && (
        <div className={styles.controls}>
          {selectedTagIds.length >= 2 && (
            <button
              type="button"
              className={styles.modeToggle}
              onClick={() => onModeChange(mode === 'and' ? 'or' : 'and')}
              aria-label={mode === 'and' ? 'Switch to OR' : 'Switch to AND'}
            >
              {mode === 'and' ? 'AND' : 'OR'}
            </button>
          )}
          <span className={styles.counter}>{totalCount} / {matchCount}</span>
          <button type="button" className={styles.clear} onClick={onClearAll} aria-label="Clear all filters">
            ×
          </button>
        </div>
      )}
    </div>
  )
}
