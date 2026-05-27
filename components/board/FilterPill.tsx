'use client'

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import type { BoardFilter } from '@/lib/board/types'
import {
  isTagsFilter,
  BOARD_FILTER_ALL, BOARD_FILTER_ARCHIVE, BOARD_FILTER_DEAD,
  boardFilterEquals,
  toggleTagInFilter,
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
  /** Right-click handler for tag rows in the dropdown. Receives viewport
   *  coords so the parent can mount a context menu near the row. */
  readonly onTagContextMenu?: (e: { clientX: number; clientY: number }, tagId: string) => void
  /** Id of the tag whose right-click menu is currently open, rendered
   *  with a red wash so the user sees which row is targeted. */
  readonly activeContextTagId?: string | null
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

/** Grace period after the cursor leaves the wrap (pill + dropdown
 *  combined) before the menu auto-closes. Matches TuneTrigger. */
const LEAVE_GRACE_MS = 700

export function FilterPill({
  value, onChange, tags, counts, tagsMatchCount, onTagContextMenu, activeContextTagId,
}: Props): ReactElement {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const effectiveLabel = labelFor(value, tags)
  const effectiveCount = countDigits(value, counts, tagsMatchCount)
  const { display: displayLabel, triggerBurst } = useChromeScramble(effectiveLabel)
  const { display: displayCount, triggerBurst: triggerCountBurst } = useChromeScramble(effectiveCount)

  /* Glitch burst when the effective label / count change (= filter
     toggled via card pill or dropdown). Without this the chrome would
     instant-swap, visually disconnected from the editorial motion
     language elsewhere. */
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

  const clearLeaveTimer = useCallback((): void => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
  }, [])

  const scheduleClose = useCallback((): void => {
    clearLeaveTimer()
    leaveTimerRef.current = setTimeout(() => {
      setOpen(false)
      leaveTimerRef.current = null
    }, LEAVE_GRACE_MS)
  }, [clearLeaveTimer])

  /* Outside-click hard-closes (mouse-leave timer is a soft path). Uses
     pointerdown so the menu doesn't briefly stay open while the user
     is mid-gesture on the next thing they're clicking. */
  useEffect(() => {
    if (!open) return
    const onDoc = (e: PointerEvent): void => {
      const target = e.target as HTMLElement | null
      if (wrapRef.current?.contains(target as Node)) return
      /* The tag context menu portals itself outside the wrap. Don't
         hard-close the dropdown when the user is interacting with the
         right-click menu it spawned — that menu owns its own close. */
      if (target?.closest('[data-testid="tag-context-menu"]')) return
      if (target?.closest('[data-testid="tag-delete-confirm-dialog"]')) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onDoc)
    return (): void => document.removeEventListener('pointerdown', onDoc)
  }, [open])

  /* Esc closes the dropdown. Mirrors the dialog / context-menu Esc
     contract elsewhere in the chrome. */
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        /* Don't fight the right-click menu / delete dialog for Esc —
           they each handle their own close. */
        if (document.querySelector('[data-testid="tag-context-menu"]')) return
        if (document.querySelector('[data-testid="tag-delete-confirm-dialog"]')) return
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    return (): void => clearLeaveTimer()
  }, [clearLeaveTimer])

  /* Exclusive selection (ALL / TRASH / DEAD): always closes. */
  const pickExclusive = (f: BoardFilter): void => {
    onChange(f)
    setOpen(false)
  }

  /* Tag toggle: keep the dropdown open so users can stack multiple
     tags without re-opening between picks. Empty tag set → onChange
     produces BOARD_FILTER_ALL (toggleTagInFilter contract), at which
     point the menu staying open is still fine — the user can pick a
     fresh tag without re-opening. */
  const toggleTag = (tagId: string): void => {
    onChange(toggleTagInFilter(value, tagId))
  }

  const activeTagIds = isTagsFilter(value) ? value.tagIds : []
  const tagsActiveSet = new Set(activeTagIds)

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      onMouseEnter={clearLeaveTimer}
      onMouseLeave={(): void => {
        if (!open) return
        scheduleClose()
      }}
    >
      <button
        type="button"
        className={styles.pill}
        onClick={() => {
          clearLeaveTimer()
          setOpen((v) => !v)
        }}
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
        <div
          className={styles.menu}
          role="menu"
          data-testid="filter-pill-menu"
        >
          <button
            type="button"
            className={`${styles.item} ${boardFilterEquals(value, BOARD_FILTER_ALL) ? styles.active : ''}`.trim()}
            onClick={() => pickExclusive(BOARD_FILTER_ALL)}
          >
            <span className={styles.itemLabel}>ALL</span>
            <span className={styles.itemCount}>{String(counts.all).padStart(3, '0')}</span>
          </button>
          <button
            type="button"
            className={`${styles.item} ${styles.trashItem} ${boardFilterEquals(value, BOARD_FILTER_ARCHIVE) ? styles.active : ''}`.trim()}
            onClick={() => pickExclusive(BOARD_FILTER_ARCHIVE)}
          >
            <span className={styles.itemLabel}>TRASH</span>
            <span className={styles.itemCount}>{String(counts.archive).padStart(3, '0')}</span>
          </button>
          {counts.dead > 0 && (
            <button
              type="button"
              className={`${styles.item} ${styles.deadItem} ${boardFilterEquals(value, BOARD_FILTER_DEAD) ? styles.active : ''}`.trim()}
              onClick={() => pickExclusive(BOARD_FILTER_DEAD)}
            >
              <span className={styles.deadDot} aria-hidden="true" />
              <span className={styles.itemLabel}>DEAD LINKS</span>
              <span className={styles.itemCount}>{String(counts.dead).padStart(3, '0')}</span>
            </button>
          )}
          {tags.length > 0 && (
            <>
              <div className={styles.sectionHeader}>
                <span>TAGS</span>
                {activeTagIds.length > 0 && (
                  <span className={styles.sectionHeaderHint}>
                    {activeTagIds.length} OF {tags.length} · OR
                  </span>
                )}
              </div>
              {tags.map((m) => {
                const active = tagsActiveSet.has(m.id)
                const contextActive = activeContextTagId === m.id
                const cls = [
                  styles.item,
                  styles.tagItem,
                  active && styles.tagItemActive,
                  contextActive && styles.contextActive,
                ].filter(Boolean).join(' ')
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={cls}
                    onClick={() => toggleTag(m.id)}
                    onContextMenu={(e): void => {
                      if (!onTagContextMenu) return
                      e.preventDefault()
                      e.stopPropagation()
                      onTagContextMenu({ clientX: e.clientX, clientY: e.clientY }, m.id)
                    }}
                    aria-pressed={active}
                    data-tag-id={m.id}
                  >
                    <span className={styles.tagDot} data-active={active ? 'true' : 'false'} aria-hidden="true" />
                    <span className={styles.itemLabel}>{m.name}</span>
                  </button>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}
