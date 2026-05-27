'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { BoardFilter } from '@/lib/board/types'
import {
  isTagsFilter,
  BOARD_FILTER_ALL, BOARD_FILTER_INBOX, BOARD_FILTER_ARCHIVE, BOARD_FILTER_DEAD,
  boardFilterEquals,
} from '@/lib/board/board-filter-helpers'
import type { TagRecord } from '@/lib/storage/indexeddb'
import { useChromeScramble } from '@/lib/board/use-idle-scramble'
import styles from './FilterPill.module.css'

type Props = {
  readonly value: BoardFilter
  readonly onChange: (f: BoardFilter) => void
  readonly tags: ReadonlyArray<TagRecord>
  readonly counts: { readonly all: number; readonly inbox: number; readonly archive: number; readonly dead: number }
  /** When the current filter is a tags filter, the parent should pass the
   *  matched bookmark count (= cardinality of the matched set) so the chrome
   *  digit reflects the active tag intersection rather than the total board
   *  count. For non-tags filters this can be undefined; the pill falls back
   *  to counts[kind]. */
  readonly tagsMatchCount?: number
}

/** Chrome label vocab — fixed English across all 15 languages
 *  (= session 42 chrome-English policy, AllMarks branding aligned).
 *  The 'all' filter doubles as the brand mark — AllMarks. */
function labelFor(f: BoardFilter, tags: ReadonlyArray<TagRecord>): string {
  switch (f.kind) {
    case 'all': return 'AllMarks'
    case 'inbox': return 'INBOX'
    case 'archive': return 'TRASH'
    case 'dead': return 'DEAD LINKS'
    case 'tags': {
      const names = f.tagIds.map((id) => tags.find((t) => t.id === id)?.name ?? '—')
      if (names.length === 0) return 'AllMarks'
      if (names.length === 1) return names[0]
      return `${names[0]} +${names.length - 1}`
    }
  }
}

function countDigits(
  f: BoardFilter,
  counts: { all: number; inbox: number; archive: number; dead: number },
  tagsMatchCount: number | undefined,
): string {
  switch (f.kind) {
    case 'all': return String(counts.all).padStart(3, '0')
    case 'inbox': return String(counts.inbox).padStart(3, '0')
    case 'archive': return String(counts.archive).padStart(3, '0')
    case 'dead': return String(counts.dead).padStart(3, '0')
    case 'tags': return String(tagsMatchCount ?? 0).padStart(3, '0')
  }
}

export function FilterPill({
  value, onChange, tags, counts, tagsMatchCount,
}: Props): ReactElement {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const effectiveLabel = labelFor(value, tags)
  const effectiveCount = countDigits(value, counts, tagsMatchCount)
  const { display: displayLabel, triggerBurst } = useChromeScramble(effectiveLabel)
  const { display: displayCount, triggerBurst: triggerCountBurst } = useChromeScramble(effectiveCount)

  // Trigger the existing hover-style scramble + glitch burst whenever the
  // effective label changes (= user toggled a tag-pill chip filter on a
  // card, or picked a different BoardFilter from the dropdown). Without
  // this the chrome would instant-swap to the new text — visually jarring
  // and disconnected from the rest of AllMarks' editorial motion language.
  const prevLabelRef = useRef(effectiveLabel)
  const prevCountRef = useRef(effectiveCount)
  useEffect(() => {
    if (prevLabelRef.current !== effectiveLabel) {
      triggerBurst()
      prevLabelRef.current = effectiveLabel
    }
  }, [effectiveLabel, triggerBurst])
  useEffect(() => {
    if (prevCountRef.current !== effectiveCount) {
      triggerCountBurst()
      prevCountRef.current = effectiveCount
    }
  }, [effectiveCount, triggerCountBurst])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent): void => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return (): void => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const select = (f: BoardFilter): void => {
    onChange(f)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <button
        type="button"
        className={styles.pill}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={triggerBurst}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="filter-pill"
      >
        <span className={styles.label} data-glitch-text={effectiveLabel}>{displayLabel}</span>
        <span className={styles.separator}>·</span>
        <span className={styles.count} data-glitch-text={effectiveCount}>{displayCount}</span>
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          <button
            type="button"
            className={`${styles.item} ${boardFilterEquals(value, BOARD_FILTER_ALL) ? styles.active : ''}`.trim()}
            onClick={() => select(BOARD_FILTER_ALL)}
          >
            ALL
            <span style={{ marginLeft: 'auto', color: 'var(--text-meta)' }}>{counts.all}</span>
          </button>
          <button
            type="button"
            className={`${styles.item} ${boardFilterEquals(value, BOARD_FILTER_ARCHIVE) ? styles.active : ''}`.trim()}
            onClick={() => select(BOARD_FILTER_ARCHIVE)}
          >
            TRASH
            <span style={{ marginLeft: 'auto', color: 'var(--text-meta)' }}>{counts.archive}</span>
          </button>
          {counts.dead > 0 && (
            <button
              type="button"
              className={`${styles.item} ${styles.deadItem} ${boardFilterEquals(value, BOARD_FILTER_DEAD) ? styles.active : ''}`.trim()}
              onClick={() => select(BOARD_FILTER_DEAD)}
            >
              <span className={styles.deadDot} />
              DEAD LINKS
              <span style={{ marginLeft: 'auto', color: 'rgba(220,80,80,0.85)' }}>{counts.dead}</span>
            </button>
          )}
          {tags.length > 0 && (
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 4px' }} />
          )}
          {tags.map((m) => {
            const f: BoardFilter = { kind: 'tags', tagIds: [m.id], mode: 'and' }
            const active = isTagsFilter(value) && value.tagIds.length === 1 && value.tagIds[0] === m.id
            return (
              <button
                key={m.id}
                type="button"
                className={`${styles.item} ${active ? styles.active : ''}`.trim()}
                onClick={() => select(f)}
              >
                {m.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
