'use client'

import { useEffect, type ReactElement } from 'react'
import type { TagRecord } from '@/lib/storage/indexeddb'
import { t } from '@/lib/i18n/t'
import { NewMoodInput } from './NewMoodInput'
import styles from './TagPicker.module.css'

type Props = {
  readonly tags: ReadonlyArray<TagRecord>
  readonly onTag: (tagId: string) => void
  readonly onSkip: () => void
  readonly onUndo: (() => void) | null
  readonly onCreateTag: (name: string) => void
  readonly suggestedTagIds?: ReadonlyArray<string>
}

export function TagPicker({ tags, onTag, onSkip, onUndo, onCreateTag, suggestedTagIds }: Props): ReactElement {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const targetTagName = (e.target as HTMLElement).tagName
      if (targetTagName === 'INPUT' || targetTagName === 'TEXTAREA') return

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
    <div className={styles.row} data-testid="tag-picker">
      {tags.slice(0, 9).map((m, i) => (
        <button key={m.id} type="button"
          className={`${styles.chip} ${(suggestedTagIds ?? []).includes(m.id) ? styles.suggested : ''}`.trim()}
          onClick={() => onTag(m.id)}
          data-testid={`mood-chip-${m.id}`}>
          <span className={styles.num}>{i + 1}</span>
          <span className={styles.dot} style={{ background: m.color }} />
          <span>{m.name}</span>
        </button>
      ))}
      <NewMoodInput onCreate={onCreateTag} />
      <button type="button" className={styles.util} onClick={onSkip}>{t('triage.skip')}</button>
      {onUndo && <button type="button" className={styles.util} onClick={onUndo}>{t('triage.undo')}</button>}
    </div>
  )
}
