'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { BoardFilter } from '@/lib/board/types'
import type { TagRecord } from '@/lib/storage/indexeddb'
import { useChromeScramble } from '@/lib/board/use-idle-scramble'
import styles from './FilterPill.module.css'

type Props = {
  readonly value: BoardFilter
  readonly onChange: (f: BoardFilter) => void
  readonly tags: ReadonlyArray<TagRecord>
  readonly counts: { readonly all: number; readonly inbox: number; readonly archive: number; readonly dead: number }
  /** When set, replaces the label derived from BoardFilter. Used by the
   *  per-card tag-pill chip filter so the chrome reflects "I am currently
   *  filtered by this tag", not the dropdown selection. The dropdown rows
   *  remain governed by `value` so the menu still shows the BoardFilter
   *  selection state unchanged. */
  readonly overrideLabel?: string
  /** Companion to overrideLabel — replaces the count digits (= matched
   *  bookmark count under the tag chip filter). */
  readonly overrideCount?: string
}

/** Chrome label vocab — fixed English across all 15 languages
 *  (= session 42 chrome-English policy, AllMarks branding aligned).
 *  The 'all' filter doubles as the brand mark — AllMarks. */
function label(f: BoardFilter, tags: ReadonlyArray<TagRecord>): string {
  if (f === 'all') return 'AllMarks'
  if (f === 'inbox') return 'INBOX'
  if (f === 'archive') return 'ARCHIVE'
  if (f === 'dead') return 'DEAD LINKS'
  // `mood:<id>` literal は IDB 永続化フォーマット (= 互換のため保持)
  const tagId = f.slice(5)
  return tags.find((m) => m.id === tagId)?.name ?? '—'
}

function countFor(f: BoardFilter, counts: { all: number; inbox: number; archive: number; dead: number }): string {
  if (f === 'all') return String(counts.all).padStart(3, '0')
  if (f === 'inbox') return String(counts.inbox).padStart(3, '0')
  if (f === 'archive') return String(counts.archive).padStart(3, '0')
  if (f === 'dead') return String(counts.dead).padStart(3, '0')
  return '---'
}

export function FilterPill({
  value, onChange, tags, counts, overrideLabel, overrideCount,
}: Props): ReactElement {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  // Resolve effective label / count: override (= tag-chip filter active) wins,
  // otherwise derive from BoardFilter as before.
  const effectiveLabel = overrideLabel ?? label(value, tags)
  const effectiveCount = overrideCount ?? countFor(value, counts)
  const { display: displayLabel, triggerBurst } = useChromeScramble(effectiveLabel)
  const { display: displayCount, triggerBurst: triggerCountBurst } = useChromeScramble(effectiveCount)

  // Trigger the existing hover-style scramble + glitch burst whenever the
  // effective label changes (= user toggled a tag-pill chip filter, or
  // picked a different BoardFilter from the dropdown). Without this the
  // chrome would instant-swap to the new text — visually jarring and
  // disconnected from the rest of AllMarks' editorial motion language.
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
            className={`${styles.item} ${value === 'all' ? styles.active : ''}`.trim()}
            onClick={() => select('all')}
          >
            ALL
            <span style={{ marginLeft: 'auto', color: 'var(--text-meta)' }}>{counts.all}</span>
          </button>
          <button
            type="button"
            className={`${styles.item} ${value === 'inbox' ? styles.active : ''}`.trim()}
            onClick={() => select('inbox')}
          >
            INBOX
            <span style={{ marginLeft: 'auto', color: 'var(--text-meta)' }}>{counts.inbox}</span>
          </button>
          <button
            type="button"
            className={`${styles.item} ${value === 'archive' ? styles.active : ''}`.trim()}
            onClick={() => select('archive')}
          >
            ARCHIVE
            <span style={{ marginLeft: 'auto', color: 'var(--text-meta)' }}>{counts.archive}</span>
          </button>
          {counts.dead > 0 && (
            <button
              type="button"
              className={`${styles.item} ${styles.deadItem} ${value === 'dead' ? styles.active : ''}`.trim()}
              onClick={() => select('dead')}
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
            const f: BoardFilter = `mood:${m.id}`
            return (
              <button
                key={m.id}
                type="button"
                className={`${styles.item} ${value === f ? styles.active : ''}`.trim()}
                onClick={() => select(f)}
              >
                <span className={styles.dot} style={{ background: m.color }} />
                {m.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
