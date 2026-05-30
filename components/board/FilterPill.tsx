'use client'

import { useCallback, useEffect, useRef, useState, type ReactElement, type PointerEvent as ReactPointerEvent } from 'react'
import type { BoardFilter } from '@/lib/board/types'
import {
  isTagsFilter,
  BOARD_FILTER_ALL, BOARD_FILTER_ARCHIVE, BOARD_FILTER_DEAD,
  boardFilterEquals,
  toggleTagInFilter,
} from '@/lib/board/board-filter-helpers'
import type { TagRecord } from '@/lib/storage/indexeddb'
import { useChromeScramble } from '@/lib/board/use-idle-scramble'
import { computeReorder } from '@/lib/board/reorder'
import { InlineTagRenameInput } from './InlineTagRenameInput'
import styles from './FilterPill.module.css'

type Props = {
  readonly value: BoardFilter
  readonly onChange: (f: BoardFilter) => void
  readonly tags: ReadonlyArray<TagRecord>
  readonly counts: { readonly all: number; readonly inbox: number; readonly archive: number; readonly dead: number }
  /** Per-tag bookmark count (= active, non-deleted set), keyed by tag id.
   *  Drives the digit shown on each tag row. Missing / 0 renders muted. */
  readonly tagCounts?: Readonly<Record<string, number>>
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
  /** Persist a new complete tag order (drag-to-reorder via the grip handle).
   *  When omitted, the grip handles are not rendered. */
  readonly onReorder?: (orderedIds: string[]) => void
  /** Id of the tag currently being renamed in place. The matching row swaps
   *  its label for a text input; null = no inline edit in progress. */
  readonly editingTagId?: string | null
  /** Commit an inline rename (trimmed new name). The parent persists + closes. */
  readonly onRenameSubmit?: (tagId: string, name: string) => void
  /** Abandon the inline rename (Esc / invalid blur). The parent just closes. */
  readonly onRenameCancel?: () => void
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
      // タグ名は常に小文字で表示 (= ユーザーが付けた中身)。 'AllMarks' や 'INBOX'
      // 等のアプリ枠ラベルは大文字のまま、 タグ名の枝だけ toLowerCase で揃える。
      const names = f.tagIds.map((id) => tags.find((t) => t.id === id)?.name.toLowerCase() ?? '—')
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
  value, onChange, tags, counts, tagCounts, tagsMatchCount, onTagContextMenu, activeContextTagId, onReorder,
  editingTagId, onRenameSubmit, onRenameCancel,
}: Props): ReactElement {
  const [open, setOpen] = useState(false)
  /* Sticky-open pin: a click on the pill latches the menu open so it stays
     after the cursor leaves (mouse-leave is the soft path). Mirrors the
     TUNE drawer's click-to-pin. The menu is always mounted now — its
     max-height transition (see CSS) handles both the open and close
     animation, so there's no mount/unmount dance. */
  const stickyRef = useRef(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Tag list scroll affordance. When the tag list overflows its max-height
     the raw scrollbar is hidden (= no-plain-scrollbar house rule) and a
     top/bottom fade mask signals "more tags above / below" instead. */
  const tagScrollRef = useRef<HTMLDivElement>(null)
  const [tagScrollEdge, setTagScrollEdge] = useState<'none' | 'top' | 'middle' | 'bottom'>('none')
  const updateTagScroll = useCallback((): void => {
    const el = tagScrollRef.current
    if (!el) { setTagScrollEdge('none'); return }
    const canScroll = el.scrollHeight > el.clientHeight + 1
    if (!canScroll) { setTagScrollEdge('none'); return }
    const atTop = el.scrollTop <= 1
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
    setTagScrollEdge(atTop ? 'top' : atBottom ? 'bottom' : 'middle')
  }, [])

  /* Drag-to-reorder state for the tag rows (grip handle). `drag` is non-null
     for the duration of a gesture: `offsetY` lifts the grabbed row with the
     pointer; `gapIndex` is where the green insertion line sits [0..tags.length].
     Other rows stay put — only a thin line shows the drop target — so the list
     never churns mid-drag. */
  const [drag, setDrag] = useState<{ id: string; offsetY: number; gapIndex: number } | null>(null)
  const draggingRef = useRef(false)
  const dragStartYRef = useRef(0)

  /* Inline-rename awareness for the auto-close guards. While a row is being
     renamed in place, the dropdown must not auto-close on mouse-leave, Esc, or
     outside-click — the input's own onBlur/Esc handle the commit/cancel. Mirror
     the prop into a ref so the long-lived window listeners read the live value. */
  const editingRef = useRef<string | null>(editingTagId ?? null)
  editingRef.current = editingTagId ?? null

  const effectiveLabel = labelFor(value, tags)
  const effectiveCount = countDigits(value, counts, tagsMatchCount)
  const { display: displayLabel, triggerBurst } = useChromeScramble(effectiveLabel)
  const { display: displayCount, triggerBurst: triggerCountBurst } = useChromeScramble(effectiveCount)

  /* Fire the label + count scramble together. Used on hover ENTER and LEAVE
     so the chrome glitches in and out — matching the TUNE drawer, which
     scrambles its readout open on hover and closed on mouse-leave. */
  const burstAll = useCallback((): void => {
    triggerBurst()
    triggerCountBurst()
  }, [triggerBurst, triggerCountBurst])

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

  /* --- Tag drag-to-reorder (grip handle) ------------------------------------
     Window pointer listeners (attached for the gesture's lifetime) drive the
     drag, so moves keep firing even when the pointer leaves the row / menu, and
     it works WITHOUT setPointerCapture — which Playwright and some touch paths
     reject. The grabbed row lifts with the pointer; a green insertion line marks
     the drop slot; on release computeReorder yields the new order. */
  const dragRef = useRef(drag)
  dragRef.current = drag

  const gapIndexAt = useCallback((clientY: number): number => {
    const container = tagScrollRef.current
    if (!container) return tags.length
    const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-tag-id]'))
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect()
      if (clientY < r.top + r.height / 2) return i
    }
    return rows.length
  }, [tags.length])

  const startTagDrag = useCallback((id: string, e: ReactPointerEvent<HTMLElement>): void => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    draggingRef.current = true
    dragStartYRef.current = e.clientY
    clearLeaveTimer()
    setDrag({ id, offsetY: 0, gapIndex: tags.findIndex((t) => t.id === id) })
  }, [clearLeaveTimer, tags])

  const dragActive = drag !== null
  useEffect(() => {
    if (!dragActive) return
    const onMove = (e: PointerEvent): void => {
      setDrag((d) => (d ? { ...d, offsetY: e.clientY - dragStartYRef.current, gapIndex: gapIndexAt(e.clientY) } : d))
    }
    const onUp = (): void => {
      const d = dragRef.current
      draggingRef.current = false
      setDrag(null)
      if (d && onReorder) {
        const ids = tags.map((t) => t.id)
        const next = computeReorder(ids, d.id, d.gapIndex)
        if (next.some((id, i) => id !== ids[i])) onReorder(next)
      }
      if (!stickyRef.current) scheduleClose()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragActive])

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
      stickyRef.current = false
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
        /* Don't fight the right-click menu / delete dialog / inline rename
           for Esc — they each handle their own close. */
        if (editingRef.current) return
        if (document.querySelector('[data-testid="tag-context-menu"]')) return
        if (document.querySelector('[data-testid="tag-delete-confirm-dialog"]')) return
        stickyRef.current = false
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    return (): void => clearLeaveTimer()
  }, [clearLeaveTimer])

  /* Inline rename can be triggered from anywhere (a dropdown row OR a card's
     tag pill). Whenever a rename target appears, force the dropdown open and
     pin it so the in-place input is visible and stays put while editing. When
     the edit ends, release the pin so the normal mouse-leave close resumes. */
  useEffect(() => {
    if (editingTagId) {
      clearLeaveTimer()
      stickyRef.current = true
      setOpen(true)
    } else {
      stickyRef.current = false
    }
  }, [editingTagId, clearLeaveTimer])

  /* Recompute the tag-list scroll affordance whenever the menu opens or
     the tag set changes. The menu is always mounted, so this just keys
     off `open`. */
  useEffect(() => {
    if (!open) return
    updateTagScroll()
  }, [open, tags, updateTagScroll])

  /* Exclusive selection (ALL / TRASH / DEAD): always closes. */
  const pickExclusive = (f: BoardFilter): void => {
    onChange(f)
    stickyRef.current = false
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
      onMouseEnter={(): void => {
        clearLeaveTimer()
        if (!open) burstAll()
        setOpen(true)
      }}
      onMouseLeave={(): void => {
        // Don't close while a drag is in flight — the pointer routinely leaves
        // the menu bounds as the grabbed row is dragged past the edge. Also keep
        // the menu open while a row is being renamed in place.
        if (draggingRef.current || stickyRef.current || editingRef.current) return
        burstAll()
        scheduleClose()
      }}
    >
      <button
        type="button"
        className={styles.pill}
        // Block focus-on-mouse-click so the pill's :focus-visible ring doesn't
        // light up when a board keyboard shortcut later flips the page into
        // keyboard modality. Tab focus (and its ring) is untouched.
        onMouseDown={(e): void => e.preventDefault()}
        onClick={() => {
          clearLeaveTimer()
          stickyRef.current = !stickyRef.current
          setOpen(stickyRef.current)
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="filter-pill"
      >
        <span className={styles.label} data-glitch-text={effectiveLabel}>{displayLabel}</span>
        <span className={styles.separator}>·</span>
        <span className={styles.count} data-glitch-text={effectiveCount}>{displayCount}</span>
      </button>
      <div
        className={styles.menu}
        role="menu"
        data-testid="filter-pill-menu"
        data-open={open ? 'true' : 'false'}
        aria-hidden={!open}
        // One handler covers every row: prevent focus-on-mouse-click so a
        // clicked row doesn't keep a ring that a board keyboard shortcut would
        // light up. No inputs live in this menu, so blanket preventDefault is
        // safe; Tab focus into the rows still works.
        onMouseDown={(e): void => e.preventDefault()}
      >
        <div className={styles.menuInner}>
          {/* ALL — pinned at the top, the default "everything" view. */}
          <button
            type="button"
            className={`${styles.item} ${boardFilterEquals(value, BOARD_FILTER_ALL) ? styles.active : ''}`.trim()}
            onClick={() => pickExclusive(BOARD_FILTER_ALL)}
          >
            <span className={styles.itemLabel}>ALL</span>
            <span className={styles.itemCount}>{String(counts.all).padStart(3, '0')}</span>
          </button>

          {/* TAGS — scrollable middle region. When the list grows past
              MAX, it scrolls internally with a top/bottom fade mask (no
              raw scrollbar) so ALL stays on top and TRASH/DEAD stay pinned
              at the bottom regardless of how many tags exist. */}
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
              <div
                ref={tagScrollRef}
                className={styles.tagScroll}
                data-card-scroll="true"
                data-scroll-edge={tagScrollEdge}
                onScroll={updateTagScroll}
              >
                {tags.map((m, index) => {
                  const active = tagsActiveSet.has(m.id)
                  const contextActive = activeContextTagId === m.id
                  const n = tagCounts?.[m.id] ?? 0
                  const isEditing = editingTagId === m.id
                  const isDragging = drag?.id === m.id
                  const dropBefore = drag != null && !isDragging && drag.gapIndex === index
                  const dropAfter =
                    drag != null && !isDragging && drag.gapIndex >= tags.length && index === tags.length - 1
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
                      onClick={() => { if (!isEditing) toggleTag(m.id) }}
                      onContextMenu={(e): void => {
                        if (!onTagContextMenu) return
                        e.preventDefault()
                        e.stopPropagation()
                        onTagContextMenu({ clientX: e.clientX, clientY: e.clientY }, m.id)
                      }}
                      aria-pressed={active}
                      data-tag-id={m.id}
                      data-dragging={isDragging ? 'true' : undefined}
                      data-drop-before={dropBefore ? 'true' : undefined}
                      data-drop-after={dropAfter ? 'true' : undefined}
                      style={isDragging ? { transform: `translateY(${drag.offsetY}px)`, position: 'relative', zIndex: 3 } : undefined}
                    >
                      {onReorder && (
                        <span
                          className={styles.grip}
                          aria-hidden="true"
                          onPointerDown={(e): void => startTagDrag(m.id, e)}
                          onClick={(e): void => e.stopPropagation()}
                        >
                          ⠿
                        </span>
                      )}
                      <span className={styles.tagDot} data-active={active ? 'true' : 'false'} aria-hidden="true" />
                      {isEditing && onRenameSubmit && onRenameCancel ? (
                        <InlineTagRenameInput
                          className={styles.renameInput}
                          duplicateClassName={styles.renameInputDuplicate}
                          currentName={m.name}
                          otherNames={tags.filter((t) => t.id !== m.id).map((t) => t.name)}
                          onSubmit={(name): void => onRenameSubmit(m.id, name)}
                          onCancel={onRenameCancel}
                          data-testid={`tag-rename-input-${m.id}`}
                        />
                      ) : (
                        <>
                          <span className={styles.itemLabel}>{m.name}</span>
                          <span
                            className={styles.itemCount}
                            data-empty={n === 0 ? 'true' : 'false'}
                          >
                            {String(n).padStart(3, '0')}
                          </span>
                        </>
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* TRASH + DEAD LINKS — pinned at the bottom, always visible so
              the user can see how many items are pending cleanup without
              scrolling the tag list. */}
          <div className={styles.bottomGroup}>
            <button
              type="button"
              className={`${styles.item} ${styles.trashItem} ${boardFilterEquals(value, BOARD_FILTER_ARCHIVE) ? styles.active : ''}`.trim()}
              onClick={() => pickExclusive(BOARD_FILTER_ARCHIVE)}
            >
              <span className={styles.itemLabel}>TRASH</span>
              <span className={styles.itemCount}>{String(counts.archive).padStart(3, '0')}</span>
            </button>
            <button
              type="button"
              className={`${styles.item} ${styles.deadItem} ${boardFilterEquals(value, BOARD_FILTER_DEAD) ? styles.active : ''}`.trim()}
              onClick={() => pickExclusive(BOARD_FILTER_DEAD)}
            >
              <span className={styles.deadDot} aria-hidden="true" />
              <span className={styles.itemLabel}>DEAD LINKS</span>
              <span className={styles.itemCount}>{String(counts.dead).padStart(3, '0')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
