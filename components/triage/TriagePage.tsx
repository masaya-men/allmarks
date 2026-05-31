'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent, type ReactElement } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useBoardData } from '@/lib/storage/use-board-data'
import { useTags } from '@/lib/storage/use-tags'
import { t } from '@/lib/i18n/t'
import { TriageCard } from './TriageCard'
import { TopTagStrip, useTagPickerKeys } from './TagPicker'
import { NewMoodInput } from './NewMoodInput'
import { AmbientBackdrop, type SwipeDecision } from './AmbientBackdrop'
import { pickPlaceholderImage } from '@/lib/board/placeholder-image'
import { TagContextMenu } from './TagContextMenu'
import { TagDeleteConfirmDialog } from './TagDeleteConfirmDialog'
import { classifyRelease, hitTestChip, type ChipRect } from '@/lib/triage/drag-gesture'
import styles from './TriagePage.module.css'

type TriageMode = 'untagged' | 'all' | { tagId: string }

const SWIPE_ANIM_MS = 360
/** Card-drag gesture thresholds (manage screen). Below TAP = open the link;
 *  a horizontal drag at/above SWIPE = yes/no; a release over a chip = tag it. */
const TAP_THRESHOLD_PX = 6
const SWIPE_THRESHOLD_PX = 60
/** How much the card follows the pointer visually. Damped (< 1) so it lifts
 *  and leans toward the drag but stays inside the glass rather than flying off
 *  the top edge — the pointer (undamped) is what reaches the chip, and the
 *  glowing chip + centred "→ tag" label show where it's headed. */
const CARD_FOLLOW_DAMP = 0.42
/** Toss-into-tag fly animation duration; the apply + advance fires after it. */
const TOSS_MS = 300
/** Snap-back-to-centre duration when a drag is released over nothing. */
const RETURN_MS = 180
/** Pixels each chip's hit rect is inflated so dropping onto the thin text
 *  chips is forgiving (fills the inter-chip gaps + a generous vertical band). */
const CHIP_HIT_PAD_X = 9
const CHIP_HIT_PAD_TOP = 30
const CHIP_HIT_PAD_BOTTOM = 16

function parseMode(raw: string | null): TriageMode | null {
  if (!raw) return null
  if (raw === 'untagged') return 'untagged'
  if (raw === 'all') return 'all'
  if (raw.startsWith('tag:')) return { tagId: raw.slice(4) }
  return null
}

export function TriagePage(): ReactElement {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = parseMode(searchParams.get('mode'))
  const { items, deletedItems, persistTags, reload: reloadBoardData, loading } = useBoardData()
  const { tags, create, remove: removeTag, rename: renameTag, reorder: reorderTag } = useTags()

  const untaggedItems = useMemo(() => items.filter((it) => !it.isDeleted && it.tags.length === 0), [items])
  const allItems = useMemo(() => items.filter((it) => !it.isDeleted), [items])

  // No mode in the URL = come straight from the board. Redirect into the
  // appropriate triage mode: untagged backlog if there is one, otherwise
  // fall through to "all" so the user can revisit existing tags on every
  // card. The replace (not push) keeps the back button sensible.
  useEffect(() => {
    if (mode !== null) return
    if (loading) return
    const target = untaggedItems.length === 0 ? 'all' : 'untagged'
    router.replace(`/triage?mode=${target}`)
  }, [mode, loading, untaggedItems.length, router])

  const queue = useMemo(() => {
    if (mode === 'untagged') return untaggedItems
    if (mode === 'all') return allItems
    if (mode && typeof mode === 'object') {
      return items.filter((it) => !it.isDeleted && it.tags.includes(mode.tagId))
    }
    return []
  }, [mode, untaggedItems, allItems, items])

  // Review mode = the user is editing existing tag assignments (= 'all'
  // or a single 'tag:X' filter), so pre-arm the chips with the current
  // card's existing tags every time the cursor moves. The user can then
  // remove / add chips and a Yes swipe stores the armed set as the new
  // tag list. In 'untagged' mode this would defeat the rapid-fire combo
  // feature (= keep your armed combo across cards while filling an
  // empty backlog), so we skip the sync there.
  const isReviewMode = mode === 'all' || (typeof mode === 'object' && mode !== null)

  const [index, setIndex] = useState(0)
  const [lastAction, setLastAction] = useState<{ bookmarkId: string; prev: readonly string[] } | null>(null)
  const [exitDecision, setExitDecision] = useState<SwipeDecision | null>(null)
  const [armedTagIds, setArmedTagIds] = useState<ReadonlySet<string>>(() => new Set())

  /* ── Card drag-to-tag gesture (manage screen) ──
     The card's image is a drag/tap handle. dragView (= the live offset + the
     chip under the pointer) drives the card's follow-transform + the strip's
     drop-target highlight; it's render state. dragRef holds the press origin
     (read by the window listeners without re-rendering). dragActive gates the
     listener effect so it attaches once per drag, not once per move. */
  const [dragView, setDragView] = useState<{ dx: number; dy: number; targetTagId: string | null } | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number } | null>(null)
  const chipRectsRef = useRef<ChipRect[]>([])
  const canvasCardHostRef = useRef<HTMLDivElement>(null)
  /* True from the moment a drop-on-tag toss starts until the apply+advance
     fires, so a second press can't double-fire during the fly animation. */
  const tossingRef = useRef(false)
  const tossTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /* A drag whose press and release land on different elements makes the
     browser fire a click on their common ancestor (= the page root), which
     would trip the click-bare-margin-to-close handler and navigate away
     mid-gesture. Set on any moved release so handleRootClick swallows that
     one synthetic click. */
  const suppressNextRootClickRef = useRef(false)

  /* Right-click / Shift+Delete context menu state. `tagId` is the chip
     the menu acts on. `x`/`y` are viewport coordinates where the menu
     will render. Null when the menu is closed. */
  const [contextMenu, setContextMenu] = useState<{ tagId: string; x: number; y: number } | null>(null)
  /* Hold-to-delete confirm state for that menu's DELETE row. Null when
     the dialog is closed. */
  const [deleteConfirm, setDeleteConfirm] = useState<{ tagId: string } | null>(null)
  /* Rename dialog state for that menu's RENAME row. Null when closed. */
  const [renameTarget, setRenameTarget] = useState<{ tagId: string } | null>(null)

  const current = queue[index] ?? null
  const total = queue.length

  /* Session 80 continuous-slide: while a swipe animation is playing
     (exitDecision != null), render the NEXT card alongside the
     current one. The incoming card enters from the side opposite to
     the exit direction so the two appear as one continuous pan.
       - Yes (= card exits right) → incoming enters from LEFT
       - No  (= card exits left)  → incoming enters from RIGHT
     */
  const incoming = (exitDecision && queue[index + 1]) ? queue[index + 1] : null
  const incomingDirection: 'from-right' | 'from-left' = exitDecision === 'yes' ? 'from-left' : 'from-right'

  // Prefetch the resolved image (thumbnail, or the same placeholder the card /
  // backdrop show for text-only cards) of the cards just ahead — and one
  // behind for Z-undo — so they're already in the browser cache when they
  // slide in. Without this the next card enters black and the image pops in a
  // beat later, breaking the smooth left/right swipe feel. Each URL is fetched
  // at most once per session (placeholders are only 4 URLs, so they warm
  // immediately; thumbnails are the real win).
  const prefetchedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (typeof window === 'undefined') return
    for (const off of [1, 2, 3, 4, -1]) {
      const it = queue[index + off]
      if (!it) continue
      const url = it.thumbnail || pickPlaceholderImage(it.url)?.url
      if (!url || prefetchedRef.current.has(url)) continue
      prefetchedRef.current.add(url)
      const img = new Image()
      img.decoding = 'async'
      img.src = url
    }
  }, [index, queue])

  // Tag strip overflow affordance. The strip is a single editorial row in a
  // fixed ~52px band; with many tags it scrolls horizontally. Raw scrollbar is
  // hidden (house rule), so a left/right fade mask signals "more tags ←/→" and
  // the wheel handler below lets a normal mouse wheel page through them — so
  // the row never looks cut off no matter how many tags exist.
  const tagStripRef = useRef<HTMLDivElement>(null)
  const [tagStripEdge, setTagStripEdge] = useState<'none' | 'start' | 'middle' | 'end'>('none')
  const updateTagStripEdge = useCallback((): void => {
    const el = tagStripRef.current
    if (!el) { setTagStripEdge('none'); return }
    const canScroll = el.scrollWidth > el.clientWidth + 1
    if (!canScroll) { setTagStripEdge('none'); return }
    const atStart = el.scrollLeft <= 1
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
    setTagStripEdge(atStart ? 'start' : atEnd ? 'end' : 'middle')
  }, [])
  useEffect(() => {
    // Why this is more than a one-shot measure: on first mount (and right
    // after tags load) the chip row hasn't been laid out yet, so scrollWidth
    // still equals clientWidth and the strip wrongly reads as "fits, no fade".
    // Two fixes together:
    //   1. Re-measure on a few timers (rAF + 60ms + 200ms) so at least one
    //      runs after fonts/layout settle and the overflow becomes real.
    //   2. Observe the INNER tag row, not just the scroll viewport. The
    //      viewport is flex:1 so its own box never changes when tags grow —
    //      observing it alone never re-fires. The inner row's width tracks the
    //      actual tag content, so adding/loading tags triggers a re-measure.
    updateTagStripEdge()
    const raf = requestAnimationFrame(updateTagStripEdge)
    const t1 = setTimeout(updateTagStripEdge, 60)
    const t2 = setTimeout(updateTagStripEdge, 200)
    const el = tagStripRef.current
    if (!el) {
      return (): void => {
        cancelAnimationFrame(raf)
        clearTimeout(t1)
        clearTimeout(t2)
      }
    }
    const ro = new ResizeObserver(updateTagStripEdge)
    ro.observe(el)
    const inner = el.firstElementChild
    if (inner) ro.observe(inner)
    return (): void => {
      cancelAnimationFrame(raf)
      clearTimeout(t1)
      clearTimeout(t2)
      ro.disconnect()
    }
  }, [tags, updateTagStripEdge])
  const handleTagStripWheel = useCallback((e: ReactWheelEvent<HTMLDivElement>): void => {
    const el = tagStripRef.current
    if (!el || el.scrollWidth <= el.clientWidth) return
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    if (delta === 0) return
    el.scrollLeft += delta
    updateTagStripEdge()
  }, [updateTagStripEdge])

  // Pre-arm the chip strip with the current card's existing tags whenever
  // the cursor moves into review mode (= 'all' or single 'tag:X'). The
  // user can then toggle chips off (= remove a tag) or on (= add a tag),
  // and a Yes swipe stores the armed set verbatim. Skipped in 'untagged'
  // mode so the rapid-fire combo workflow keeps the armed set across
  // cards (= session 79 design).
  const currentBookmarkId = current?.bookmarkId
  const currentTagsKey = current?.tags.join(',') ?? ''
  useEffect(() => {
    if (!isReviewMode) return
    if (!currentBookmarkId) return
    setArmedTagIds(new Set(current?.tags ?? []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBookmarkId, currentTagsKey, isReviewMode])

  const toggleArmed = useCallback((tagId: string): void => {
    setArmedTagIds((prev) => {
      const next = new Set(prev)
      if (next.has(tagId)) next.delete(tagId)
      else next.add(tagId)
      return next
    })
  }, [])

  /** Yes: apply ALL armed tags (union with the card's existing tags so we
   *  never silently strip pre-existing tags in `all` mode) + advance.
   *  Yes always advances; if nothing armed, it's equivalent to No (a skip),
   *  which is clearer than swallowing the key silently.
   *
   *  Session 82: lastAction is recorded on every swipe (Yes-with-tags,
   *  Yes-without-tags, No) so Z always means "give me the previous card
   *  back" — tags revert if they were changed, no-op if they weren't. */
  const handleYes = useCallback((): void => {
    if (!current || exitDecision) return
    // armed is now the SOURCE OF TRUTH for the card's new tag list. In
    // review mode the strip starts pre-armed with current.tags, so this
    // semantic lets the user *remove* a tag by un-arming the chip. In
    // 'untagged' mode current.tags is empty, so armed-only is also union
    // (= no behavior change for the rapid-fire combo workflow).
    setLastAction({ bookmarkId: current.bookmarkId, prev: [...current.tags] })
    setExitDecision('yes')
    const composed: string[] = Array.from(armedTagIds)
    const bookmarkId = current.bookmarkId
    setTimeout((): void => {
      void persistTags(bookmarkId, composed).finally((): void => {
        setExitDecision(null)
        // In `untagged` mode, applying any tag auto-removes the card from
        // the queue (= queue shrinks), so we don't advance. In every
        // other case the queue length is stable, so we must advance.
        const queueShrinks = mode === 'untagged' && armedTagIds.size > 0
        if (!queueShrinks) setIndex((i) => i + 1)
      })
    }, SWIPE_ANIM_MS)
  }, [current, exitDecision, armedTagIds, persistTags, mode])

  /** No: don't apply tags, just advance. Animation slides card left.
   *  Session 82: also records lastAction so Z can step back to this
   *  card with no tag mutation (= "give me the previous card back"). */
  const handleNo = useCallback((): void => {
    if (!current || exitDecision) return
    setLastAction({ bookmarkId: current.bookmarkId, prev: [...current.tags] })
    setExitDecision('no')
    setTimeout((): void => {
      setExitDecision(null)
      setIndex((i) => i + 1)
    }, SWIPE_ANIM_MS)
  }, [current, exitDecision])

  /** Bookmark we want to jump back to after the queue re-derives from
   *  the updated items list. Consumed in the useEffect below. */
  const undoTargetRef = useRef<string | null>(null)

  /** Undo: step back to the previous card. Reverts tag mutation if there
   *  was one; if the previous swipe was a plain No, persistTags with the
   *  unchanged array is a no-op (idempotent in the IDB layer) and we just
   *  reposition the cursor. Bails during the slide animation because the
   *  pending setTimeout in handleYes/handleNo would race the index after
   *  we revert. */
  const handleUndo = useCallback(async (): Promise<void> => {
    if (!lastAction || exitDecision) return
    const targetId = lastAction.bookmarkId
    undoTargetRef.current = targetId
    await persistTags(targetId, lastAction.prev)
    setLastAction(null)
    /* When tags didn't actually change, the queue identity is stable
       and the queue-watching useEffect below won't fire — so reposition
       here directly. Idempotent with the effect-driven path. */
    const idx = queue.findIndex((it) => it.bookmarkId === targetId)
    if (idx >= 0) setIndex(idx)
  }, [lastAction, exitDecision, persistTags, queue])

  /** After persistTags resolves and the items list / queue rebuilds,
   *  locate the undone bookmark in the new queue and jump the cursor
   *  there. Works across `all` / `untagged` / `tag:X` modes since each
   *  computes its own queue. Falls through (= no setIndex) if the
   *  bookmark isn't in the current mode's queue. */
  useEffect(() => {
    const target = undoTargetRef.current
    if (!target) return
    const idx = queue.findIndex((it) => it.bookmarkId === target)
    if (idx >= 0) setIndex(idx)
    undoTargetRef.current = null
  }, [queue])

  const handleCreateTagAddArmed = useCallback(async (name: string): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed) return
    const colors = ['#7c5cfc', '#e066d7', '#4ecdc4', '#f5a623', '#ff6b6b']
    const color = colors[tags.length % colors.length]
    const created = await create({ name: trimmed, color, order: tags.length })
    setArmedTagIds((prev) => {
      const next = new Set(prev)
      next.add(created.id)
      return next
    })
  }, [tags.length, create])

  const exit = useCallback((): void => { router.push('/board') }, [router])

  // session 88: 全カード処理完了 (= !current && total > 0) を観測したら board
  // に自動遷移する。 旧コードはここで「All done. Back to board」 のダサい
  // 完了画面を出していたが、 user 体感では「最後にもう 1 click」 だけだった。
  // total === 0 (= 最初から空) のときは別パスで「Inbox 空」 メッセージを残す
  // (= 自動遷移すると user は「triage を開いたら一瞬で消えた」 体験になる)。
  useEffect((): void => {
    if (loading) return
    if (!mode) return
    const current = queue[index]
    if (current) return
    if (queue.length === 0) return
    exit()
  }, [loading, mode, queue, index, exit])

  /* Open the right-click context menu near the pointer for the given
     chip. Caller is the TopTagStrip's onContextMenu handler. */
  const openChipContextMenu = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>, tagId: string): void => {
      setContextMenu({ tagId, x: e.clientX, y: e.clientY })
    },
    [],
  )

  /* Bookmark-count lookup used by both the context menu header and
     the confirm dialog body. Walks both active items and TRASH so the
     number reflects what deleteTagCascade will actually detach
     (= scrubs the tag id from every bookmark regardless of soft-delete
     state). */
  const tagBookmarkCount = useCallback(
    (tagId: string): number => {
      let n = 0
      for (const it of items) if (it.tags.includes(tagId)) n++
      for (const it of deletedItems) if (it.tags.includes(tagId)) n++
      return n
    },
    [items, deletedItems],
  )

  /* Run the actual cascade: scrub the tag from every bookmark + drop
     it from the tags store, then refresh the board state so items'
     tags[] no longer reference the dead id. Also un-arm the chip in
     case it was armed at delete time so the next Yes swipe doesn't
     try to re-attach a phantom id. */
  const handleConfirmTagDelete = useCallback(
    async (tagId: string): Promise<void> => {
      await removeTag(tagId)
      await reloadBoardData()
      setArmedTagIds((prev) => {
        if (!prev.has(tagId)) return prev
        const next = new Set(prev)
        next.delete(tagId)
        return next
      })
      setDeleteConfirm(null)
    },
    [removeTag, reloadBoardData],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      /* Shift+Delete on a focused tag chip opens the context menu near
         the chip's right edge. Mirrors the right-click flow so users
         on physical keyboards / accessibility tools have an equal
         path to tag deletion. Looked at before Esc so the keys never
         compete (Esc still closes any open menu via its own listener). */
      if (e.key === 'Delete' && e.shiftKey) {
        const active = document.activeElement as HTMLElement | null
        const tagId = active?.getAttribute('data-tag-id')
        if (tagId) {
          e.preventDefault()
          const rect = active!.getBoundingClientRect()
          setContextMenu({ tagId, x: rect.right, y: rect.bottom + 4 })
          return
        }
      }

      if (e.key === 'Escape') {
        /* Let an open context menu / delete dialog absorb Esc before
           the page-level exit fires, otherwise pressing Esc to close
           the menu would also yank the user back to /board. */
        if (contextMenu || deleteConfirm) return
        e.preventDefault(); exit(); return
      }
      if (!mode) return
      const lk = e.key.toLowerCase()
      if (e.key === 'ArrowRight' || lk === 'd') { e.preventDefault(); handleYes(); return }
      if (e.key === 'ArrowLeft'  || lk === 'a') { e.preventDefault(); handleNo();  return }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [exit, handleYes, handleNo, mode, contextMenu, deleteConfirm])

  useTagPickerKeys({
    tags,
    onToggleArmed: toggleArmed,
    onNo: handleNo,
    onUndo: lastAction ? handleUndo : null,
  })

  /* Snapshot the current chip rects (inflated for forgiving drops) for
     pointer hit-testing. Captured at press time; the strip doesn't move
     during a drag. Viewport coords match pointer clientX/Y. */
  const collectChipRects = useCallback((): ChipRect[] => {
    const root = tagStripRef.current
    if (!root) return []
    const out: ChipRect[] = []
    root.querySelectorAll<HTMLElement>('[data-tag-id]').forEach((el) => {
      const id = el.getAttribute('data-tag-id')
      if (!id) return
      const r = el.getBoundingClientRect()
      out.push({
        tagId: id,
        left: r.left - CHIP_HIT_PAD_X,
        right: r.right + CHIP_HIT_PAD_X,
        top: r.top - CHIP_HIT_PAD_TOP,
        bottom: r.bottom + CHIP_HIT_PAD_BOTTOM,
      })
    })
    return out
  }, [])

  /* Apply a single dropped tag (kept alongside the card's existing + any
     armed tags so we never strip) and advance, mirroring handleYes. In
     'untagged' mode applying any tag drops the card from the queue, so we
     don't advance the index; otherwise we do. */
  const applyDropTag = useCallback((tagId: string): void => {
    if (!current) return
    setLastAction({ bookmarkId: current.bookmarkId, prev: [...current.tags] })
    const composed = Array.from(new Set<string>([...current.tags, ...armedTagIds, tagId]))
    const bookmarkId = current.bookmarkId
    void persistTags(bookmarkId, composed).finally((): void => {
      if (mode !== 'untagged') setIndex((i) => i + 1)
    })
  }, [current, armedTagIds, persistTags, mode])

  /* Decide what a pointer release means and act on it. */
  const handleRelease = useCallback(
    (dx: number, dy: number, targetTagId: string | null): void => {
      const outcome = classifyRelease({
        dx, dy, targetTagId,
        tapThresholdPx: TAP_THRESHOLD_PX,
        swipeThresholdPx: SWIPE_THRESHOLD_PX,
      })
      // Any moved release ends with a synthetic click on the root; swallow it.
      if (outcome.kind !== 'open') suppressNextRootClickRef.current = true
      const cardEl = canvasCardHostRef.current?.querySelector<HTMLElement>('[data-testid="triage-card"]')

      // The card follows the pointer damped (see CARD_FOLLOW_DAMP), so its
      // current visual offset is the damped delta — animations must start there.
      const vx = dx * CARD_FOLLOW_DAMP
      const vy = dy * CARD_FOLLOW_DAMP

      if (outcome.kind === 'tag') {
        // Fly the card from its dragged spot into the targeted chip, then
        // apply + advance. WAAPI with explicit from/to so it animates cleanly
        // even though React drops the inline transform on the same tick.
        const from = `translate(${vx}px, ${vy}px) scale(1.04)`
        let to = `translate(${vx}px, ${vy}px) scale(0.08)`
        if (cardEl) {
          const cr = cardEl.getBoundingClientRect()
          const chip = chipRectsRef.current.find((c) => c.tagId === outcome.tagId)
          if (chip) {
            const tdx = (chip.left + chip.right) / 2 - (cr.left + cr.width / 2)
            const tdy = (chip.top + chip.bottom) / 2 - (cr.top + cr.height / 2)
            to = `translate(${vx + tdx}px, ${vy + tdy}px) scale(0.08)`
          }
        }
        tossingRef.current = true
        setDragView(null)
        cardEl?.animate(
          [{ transform: from, opacity: 1 }, { transform: to, opacity: 0 }],
          { duration: TOSS_MS, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' },
        )
        if (tossTimerRef.current) clearTimeout(tossTimerRef.current)
        const tagToApply = outcome.tagId
        tossTimerRef.current = setTimeout((): void => {
          tossingRef.current = false
          tossTimerRef.current = null
          applyDropTag(tagToApply)
        }, TOSS_MS)
        return
      }

      if (outcome.kind === 'open') {
        setDragView(null)
        if (current) window.open(current.url, '_blank', 'noopener,noreferrer')
        return
      }

      if (outcome.kind === 'cancel') {
        // Smooth snap back to centre.
        const from = `translate(${vx}px, ${vy}px) scale(1.04)`
        setDragView(null)
        cardEl?.animate(
          [{ transform: from }, { transform: 'translate(0px, 0px) scale(1)' }],
          { duration: RETURN_MS, easing: 'ease-out', fill: 'none' },
        )
        return
      }

      // yes / no swipe — hand off to the existing slide + persist logic.
      setDragView(null)
      if (outcome.kind === 'yes') handleYes()
      else handleNo()
    },
    [current, handleYes, handleNo, applyDropTag],
  )
  const handleReleaseRef = useRef(handleRelease)
  handleReleaseRef.current = handleRelease

  const onSurfacePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>): void => {
      if (exitDecision || tossingRef.current) return
      // Block native image-drag / text selection so the follow-drag is clean.
      e.preventDefault()
      chipRectsRef.current = collectChipRects()
      dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY }
      setDragView({ dx: 0, dy: 0, targetTagId: null })
      setDragActive(true)
    },
    [exitDecision, collectChipRects],
  )

  // Attach window pointer listeners once per drag (gated on dragActive, NOT on
  // the per-move dragView), so a 60fps move stream doesn't re-bind listeners.
  useEffect(() => {
    if (!dragActive) return
    const onMove = (e: PointerEvent): void => {
      const d = dragRef.current
      if (!d || e.pointerId !== d.pointerId) return
      const dx = e.clientX - d.startX
      const dy = e.clientY - d.startY
      const targetTagId = hitTestChip(e.clientX, e.clientY, chipRectsRef.current)
      setDragView({ dx, dy, targetTagId })
    }
    const onUp = (e: PointerEvent): void => {
      const d = dragRef.current
      if (!d || e.pointerId !== d.pointerId) return
      const dx = e.clientX - d.startX
      const dy = e.clientY - d.startY
      const targetTagId = hitTestChip(e.clientX, e.clientY, chipRectsRef.current)
      dragRef.current = null
      setDragActive(false)
      handleReleaseRef.current(dx, dy, targetTagId)
    }
    const onCancel = (): void => {
      dragRef.current = null
      setDragActive(false)
      setDragView(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [dragActive])

  useEffect(() => (): void => { if (tossTimerRef.current) clearTimeout(tossTimerRef.current) }, [])

  if (loading) {
    return (
      <div className={styles.simpleRoot}>
        <div className={styles.main}><div>Loading…</div></div>
      </div>
    )
  }

  // mode === null is a transient state — the useEffect above will replace
  // the URL on the next tick. Render a loading placeholder so we don't
  // flash blank canvas during the redirect.
  if (!mode) {
    return (
      <div className={styles.simpleRoot}>
        <div className={styles.main}><div>Loading…</div></div>
      </div>
    )
  }

  if (!current) {
    // session 88: 「全部完了」 のときは静かに board に自動遷移する。 旧コードの
    // ダサい done 画面 (= "All done. Back to board" ボタン) は user 体感が
    // 「最後にもう 1 click 増える」 だけだったので削除。 total === 0 (= 初めから
    // 空) のときだけは「キュー無し」 メッセージを残す (= 自動遷移すると user は
    // 「triage を開いたら一瞬で消えた」 体験になるため)。
    if (total === 0) {
      return (
        <div className={styles.simpleRoot}>
          <div className={styles.main}>
            <div className={styles.empty}>
              <div style={{ fontSize: 20, fontFamily: 'var(--font-sans)' }}>
                {t('triage.empty')}
              </div>
              <button type="button" className={styles.backBtn} onClick={exit}>
                {t('triage.empty_cta')}
              </button>
            </div>
          </div>
        </div>
      )
    }
    // total > 0 で current 無し = 全カード処理完了 → 下の useEffect で board
    // に自動遷移する。 ここでは遷移中のブランクだけ描画。
    return <div className={styles.simpleRoot} />
  }

  // Zero-pad to 2 digits so the chrome reads as the same "data plate"
  // language as the FilterPill's 3-digit count (= "AllMarks · 042" etc.).
  // 100+ items naturally overflows the padding, which is fine.
  const pad2 = (n: number): string => String(n).padStart(2, '0')
  const progressText = t('triage.progress')
    .replace('{current}', pad2(index + 1))
    .replace('{total}', pad2(total))

  // Click outside the glass / chrome (= the bare black margin) closes the
  // page, mirroring the ESC button. Buttons + chip strip stop the event
  // at their own elements so e.target !== currentTarget there; the heading
  // + progress are pointer-events:none so clicks fall through to root.
  const handleRootClick = (e: ReactMouseEvent<HTMLDivElement>): void => {
    /* Swallow the synthetic click the browser fires on the root right after a
       moved card drag (press + release on different elements) — without this
       a drag-to-tag / swipe would also read as a "click the bare margin to
       close" and navigate to /board mid-gesture. */
    if (suppressNextRootClickRef.current) {
      suppressNextRootClickRef.current = false
      return
    }
    /* While a chip context menu or the delete-confirm dialog is open,
       any background pointerdown is consumed by the menu/dialog's own
       outside-click handler to close itself — the subsequent click on
       the bare margin must NOT also fire `exit()` and yank the user
       off the page. */
    if (contextMenu || deleteConfirm || renameTarget) return
    if (e.target === e.currentTarget) exit()
  }

  return (
    <div
      className={styles.root}
      data-testid="triage-page"
      onClick={handleRootClick}
    >
      <AmbientBackdrop item={current} exitDecision={exitDecision} />
      {incoming && (
        <AmbientBackdrop
          key={`incoming-bg-${incoming.bookmarkId}`}
          item={incoming}
          role="incoming"
          enterDirection={incomingDirection}
        />
      )}

      {/* Outer chrome — editorial 2-row layout (session 81):
            Row 1: "TAG THIS." headline (left)  +  progress + ESC (right)
            Row 2: chip strip (full width, beneath the headline) */}
      <h1 className={styles.outerHeading} aria-label="Tag this card">
        TAG THIS<span className={styles.headingAccent}>.</span>
      </h1>
      <span className={styles.outerProgress}>{progressText}</span>
      <div className={styles.outerTagStrip}>
        <div
          ref={tagStripRef}
          className={styles.tagScrollRegion}
          data-scroll-edge={tagStripEdge}
          onScroll={updateTagStripEdge}
          onWheel={handleTagStripWheel}
        >
          <TopTagStrip
            tags={tags}
            armedTagIds={armedTagIds}
            onToggle={toggleArmed}
            onChipContextMenu={openChipContextMenu}
            activeContextTagId={contextMenu?.tagId ?? deleteConfirm?.tagId ?? null}
            showAddButton={false}
            onReorder={(orderedIds): void => { void reorderTag(orderedIds) }}
            editingTagId={renameTarget?.tagId ?? null}
            onRenameSubmit={(tagId, name): void => {
              void renameTag(tagId, name)
              setRenameTarget(null)
            }}
            onRenameCancel={(): void => setRenameTarget(null)}
            cardDragActive={dragView != null}
            dropTargetTagId={dragView?.targetTagId ?? null}
          />
        </div>
        {/* + TAG pinned to the right edge, outside the scroll region, so it's
            always visible and never caught by the fade no matter how many
            tags exist. */}
        <div className={styles.addTagPinned}>
          <NewMoodInput onCreate={handleCreateTagAddArmed} />
        </div>
      </div>
      <button type="button" className={styles.outerBackBtn} onClick={exit}>ESC</button>

      {/* SVG defs for the glass refraction filter (= reused from session 78). */}
      <svg className={styles.glassFilterDefs} aria-hidden="true">
        <defs>
          <filter id="triage-glass-refract" x="0%" y="0%" width="100%" height="100%">
            <feImage
              href="/displacement/lens-edge.png"
              result="dmap"
              preserveAspectRatio="none"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="dmap"
              scale="80"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* Central glass canvas — overflow:hidden clips the card as it slides off.
          Gestures live on the card's image surface (drag-to-tag / tap-to-open /
          swipe), wired via onSurfacePointerDown below, so the text panel stays
          freely selectable. */}
      <div className={styles.canvas}>
        <div className={styles.canvasCardHost} ref={canvasCardHostRef}>
          <TriageCard
            key={current.bookmarkId}
            item={current}
            exitDecision={exitDecision}
            onSurfacePointerDown={onSurfacePointerDown}
            liveTransform={dragView ? `translate(${dragView.dx * CARD_FOLLOW_DAMP}px, ${dragView.dy * CARD_FOLLOW_DAMP}px) scale(1.04)` : null}
            isDragging={dragView != null}
            targetTagName={dragView?.targetTagId ? tags.find((tg) => tg.id === dragView.targetTagId)?.name ?? null : null}
          />
          {incoming && (
            <TriageCard
              key={`incoming-${incoming.bookmarkId}`}
              item={incoming}
              role="incoming"
              enterDirection={incomingDirection}
            />
          )}
        </div>

        {/* Yes / No swipe hints — sit on the glass pane (inside canvas).
            Clickable buttons so mouse users have a direct path (= not
            just swipe / keyboard). */}
        <button
          type="button"
          className={`${styles.swipeHint} ${styles.noHint}`}
          // Block focus-on-click so the button doesn't keep the focus ring that
          // would light up on the next keyboard shortcut (see TagPicker chip).
          onMouseDown={(e): void => e.preventDefault()}
          onClick={handleNo}
          aria-label="No, skip this card"
          data-testid="triage-no-button"
        >
          <span className={styles.swipeArrow}>←</span>
          <span className={styles.swipeVerdict}>NO</span>
        </button>
        <button
          type="button"
          className={`${styles.swipeHint} ${styles.yesHint}`}
          onMouseDown={(e): void => e.preventDefault()}
          onClick={handleYes}
          aria-label="Yes, apply armed tags"
          data-testid="triage-yes-button"
        >
          <span className={styles.swipeVerdict}>YES</span>
          <span className={styles.swipeArrow}>→</span>
        </button>

        <div className={styles.canvasFooter}>{t('triage.hint')}</div>
      </div>

      {/* Tag right-click / Shift+Delete context menu. Looks up the
          targeted tag by id from the current tags list — guards
          against the rare case where the tag was deleted in another
          tab between menu open and the next render. */}
      {contextMenu && (() => {
        const targetTag = tags.find((tg) => tg.id === contextMenu.tagId)
        if (!targetTag) return null
        return (
          <TagContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            tagName={targetTag.name}
            bookmarkCount={tagBookmarkCount(targetTag.id)}
            onRename={(): void => {
              setRenameTarget({ tagId: targetTag.id })
              setContextMenu(null)
            }}
            onDelete={(): void => {
              setDeleteConfirm({ tagId: targetTag.id })
              setContextMenu(null)
            }}
            onClose={(): void => setContextMenu(null)}
          />
        )
      })()}

      {/* Hold-to-delete confirm dialog for the targeted tag. Mirrors
          the empty-trash dialog's 2-second hold mechanic so the
          gesture vocabulary is consistent across destructive
          actions. */}
      {deleteConfirm && (() => {
        const targetTag = tags.find((tg) => tg.id === deleteConfirm.tagId)
        if (!targetTag) return null
        return (
          <TagDeleteConfirmDialog
            tagName={targetTag.name}
            bookmarkCount={tagBookmarkCount(targetTag.id)}
            onConfirm={(): void => { void handleConfirmTagDelete(targetTag.id) }}
            onCancel={(): void => setDeleteConfirm(null)}
          />
        )
      })()}
    </div>
  )
}

