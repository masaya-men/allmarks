'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { computeSkylineLayout, type SkylineCard } from '@/lib/board/skyline-layout'
import { computeFocusScrollY } from '@/lib/board/scroll-to-card'
import {
  DEFAULT_THEME_ID,
  getThemeMeta,
} from '@/lib/board/theme-registry'
import { BOARD_INNER, BOARD_SLIDERS } from '@/lib/board/constants'
import { getDefaultVolume } from '@/lib/embed/default-volume'
import type { BoardFilter, CardPosition, DisplayMode } from '@/lib/board/types'
import { applyFilter } from '@/lib/board/filter'
import { useBoardData } from '@/lib/storage/use-board-data'
import { RevalidationQueue, defaultFetcher, shouldRevalidate } from '@/lib/board/revalidate'
import { subscribeBookmarkSaved } from '@/lib/board/channel'
import { detectUrlType, extractTweetId } from '@/lib/utils/url'
import { fetchTweetMeta } from '@/lib/embed/tweet-meta'
import { createBackfillQueue } from '@/lib/board/backfill-queue'
import { backfillTweetMeta } from '@/lib/board/tweet-backfill'
import { fetchTikTokMeta } from '@/lib/embed/tiktok-meta'
import { useTags } from '@/lib/storage/use-tags'
import {
  BOARD_FILTER_ALL,
  boardFilterEquals,
  isTagsFilter,
  toggleTagInFilter,
} from '@/lib/board/board-filter-helpers'
import { initDB } from '@/lib/storage/indexeddb'
import { loadBoardConfig, saveBoardConfig } from '@/lib/storage/board-config'
import { ThemeLayer } from './ThemeLayer'
import {
  BoardBackgroundTypography,
  isBoardBgTypoVariant,
  type BoardBgTypoVariant,
} from './BoardBackgroundTypography'
import { CardsLayer } from './CardsLayer'
import { InteractionLayer } from './InteractionLayer'
import { TopHeader } from './TopHeader'
import { FilterPill } from './FilterPill'
import { TrashConfirmDialog } from './TrashConfirmDialog'
import { TagContextMenu } from '@/components/triage/TagContextMenu'
import { TagDeleteConfirmDialog } from '@/components/triage/TagDeleteConfirmDialog'
import { useRouter } from 'next/navigation'
import { TagButton } from './TagButton'
import { addTag, addTagToBookmark, removeTagFromBookmark } from '@/lib/storage/tags'
import { MotionToggle } from './MotionToggle'
import { TuneTrigger } from './TuneTrigger'
import { ChromeButton } from './ChromeButton'
import { ScrollMeter } from './ScrollMeter'
import { BoardChrome } from './BoardChrome'
import { UndoToast, type UndoToastInput } from './UndoToast'
import { type UndoEntry, MAX_UNDO_STACK, pushBounded } from '@/lib/board/undo-stack'
import { PRESETS, type PresetId } from '@/lib/board/tune-presets'
import { t } from '@/lib/i18n/t'
import { BookmarkletInstallModal } from '@/components/bookmarklet/BookmarkletInstallModal'
import { BookmarkletPill } from '@/components/bookmarklet/BookmarkletPill'
import { EmptyStateWelcome } from '@/components/bookmarklet/EmptyStateWelcome'
import { Lightbox } from './Lightbox'
import { PipPortal } from '@/components/pip/PipPortal'
import { PipCompanion } from '@/components/pip/PipCompanion'
import { usePipWindow } from '@/lib/board/pip-window'
import { SenderShareModal } from '@/components/share/SenderShareModal'
import { buildShareDataFromBoard } from '@/lib/share/board-to-share'
import type { ShareDataV2 } from '@/lib/share/types-v2'
import type { MirrorItem, MirrorPosition } from '@/components/share/ShareMirror'
import styles from './BoardRoot.module.css'

// Visible breathing room above the board's first card, in CSS pixels.
// Cards' world coords start at y=0 (masonry cursor); this offset is applied
// in the cards wrapper's transform so the first row never kisses the Toolbar
// pill. Extends the scroll range via contentBounds.height.
const BOARD_TOP_PAD_PX = 80

export function BoardRoot() {
  const {
    items,
    deletedItems,
    loading,
    persistOrderBatch,
    persistMeasuredAspect,
    persistThumbnail,
    persistMediaSlots,
    persistVideoFlag,
    persistTitle,
    persistSoftDelete,
    emptyTrash,
    persistCustomWidth,
    resetCustomWidth,
    reload,
    persistLinkStatus,
  } = useBoardData()
  const { tags, reload: reloadTags, remove: removeTag } = useTags()
  const router = useRouter()
  const [activeFilter, setActiveFilter] = useState<BoardFilter>(BOARD_FILTER_ALL)
  // Background-typography animation variant. `'static'` (fixed centred
  // headline) is the only treatment wired up today; the URL query
  // `?bgtypo=...` lets us swap in future variants (dvd-bounce, glitch,
  // marquee, card-wind, multi) without touching this file again.
  const [bgTypoVariant, setBgTypoVariant] = useState<BoardBgTypoVariant>('static')
  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = new URL(window.location.href).searchParams.get('bgtypo')
    if (raw && isBoardBgTypoVariant(raw)) setBgTypoVariant(raw)
  }, [])
  const [displayMode, setDisplayMode] = useState<DisplayMode>('visual')
  const [motionEnabled, setMotionEnabled] = useState<boolean>(true)
  const [viewport, setViewport] = useState({ x: 0, y: 0, w: 1200, h: 800 })
  // Mirror viewport in a ref so the edge auto-scroll rAF tick (which fires
  // outside React's render cycle) can read the latest scroll position
  // without going through stale closures.
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport

  // Undo / redo: in-memory only (clears on reload, matches Figma / Notion
  // industry-standard behaviour). Each mutating board action pushes a
  // snapshot of the pre-action state to undoStack; Ctrl/Cmd+Z applies the
  // top entry and pushes an inverse snapshot to redoStack. Any new
  // mutating action clears redoStack.
  const [undoStack, setUndoStack] = useState<readonly UndoEntry[]>([])
  const [redoStack, setRedoStack] = useState<readonly UndoEntry[]>([])
  const [toast, setToast] = useState<UndoToastInput>(null)
  // Ref mirrors so the keydown listener — registered once at mount — reads
  // the latest stacks without re-binding every render.
  const undoStackRef = useRef(undoStack)
  undoStackRef.current = undoStack
  const redoStackRef = useRef(redoStack)
  redoStackRef.current = redoStack
  // When true, the next items-diff effect should swallow the change instead
  // of pushing a synthetic 'add' undo entry. Used while applying an undo /
  // redo so the resulting items mutation does not register as a new user
  // action.
  const suppressItemDetectRef = useRef<boolean>(false)
  // Previous items id set, populated lazily once the first non-loading
  // render arrives. Null = "we have not seen items yet" so the initial
  // hydrate does NOT count as user adds.
  const prevItemIdsRef = useRef<Set<string> | null>(null)
  // Lifted from InteractionLayer so CardsLayer can also observe Space-held
  // state and bail its pointerdown handler — letting the event bubble up to
  // InteractionLayer where pan engagement lives.
  const [spaceHeld, setSpaceHeld] = useState<boolean>(false)
  const [bookmarkletModalOpen, setBookmarkletModalOpen] = useState<boolean>(false)
  const [hoveredBookmarkId, setHoveredBookmarkId] = useState<string | null>(null)
  // True during an active scroll session (any source: wheel, drag, meter jump).
  // Goes false 200ms after the last scroll delta. Consumers (CardSlideshow's
  // tweet-video frame extraction) check this to defer expensive new work
  // until the scroll settles — keeps the canvas smooth during fast scroll.
  const [isScrolling, setIsScrolling] = useState<boolean>(false)
  const scrollIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const markScrollActive = useCallback((): void => {
    setIsScrolling((cur) => (cur ? cur : true))
    if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current)
    scrollIdleTimerRef.current = setTimeout(() => setIsScrolling(false), 200)
  }, [])
  useEffect(() => () => {
    if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current)
  }, [])
  // Phase 1 multi-playback (Tier 3): the single card currently playing with
  // audio. Pressing a card's media indicator toggles this; pressing a
  // different card switches the audio over to it. The 4-slot pinned pool
  // replaces this single-id model in Phase 2.
  const [audioActiveId, setAudioActiveId] = useState<string | null>(null)
  const handleToggleAudio = useCallback((bookmarkId: string): void => {
    setAudioActiveId((cur) => (cur === bookmarkId ? null : bookmarkId))
  }, [])
  // Per-card ephemeral playback controls for the single active card. Volume is
  // seeded from the global default and is NOT persisted (resets on reload / when
  // another card becomes active) — this is the basis of the future multi-card
  // mix where the user sets each card's level independently.
  const [audioVolume, setAudioVolume] = useState<number>(50)
  const [audioPaused, setAudioPaused] = useState<boolean>(false)
  useEffect(() => {
    if (audioActiveId) {
      setAudioVolume(getDefaultVolume())
      setAudioPaused(false)
    }
  }, [audioActiveId])
  const handleAudioTogglePause = useCallback((): void => {
    setAudioPaused((p) => !p)
  }, [])
  const [lightboxItemId, setLightboxItemId] = useState<string | null>(null)
  // Identity of the card that originally opened the lightbox. Stays
  // pinned to the first click even when chevron-nav swaps the displayed
  // item — so close always returns the lightbox to where it came from,
  // and the source card is the one held blank on the board (B-#11).
  const [lightboxSourceItemId, setLightboxSourceItemId] = useState<string | null>(null)
  // Captured at click time so Lightbox can grow from the card's exact screen
  // position (FLIP). Cleared on close. Plain DOMRect — fallback origin for
  // the close tween when the source card is no longer in the DOM (e.g.
  // culled off-screen). The Lightbox now prefers a live DOMRect looked up
  // via `data-bookmark-id` on close so pan/scroll during open are honoured.
  const [lightboxOriginRect, setLightboxOriginRect] = useState<DOMRect | null>(null)
  const [newlyAddedIds, setNewlyAddedIds] = useState<ReadonlySet<string>>(new Set())
  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false)
  // When focusCard is called for a bookmark not in the current filtered view
  // (e.g. user is on a tags filter but the PiP-clicked card has different
  // tags), we clear the filter to BOARD_FILTER_ALL and stash the cardId here.
  // The retry useEffect below picks this up after filteredItems re-renders
  // and completes the scroll.
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null)
  const [cardWidthPx, setCardWidthPx] = useState<number>(BOARD_SLIDERS.CARD_WIDTH_DEFAULT_PX)
  const [cardGapPx, setCardGapPx] = useState<number>(BOARD_SLIDERS.CARD_GAP_DEFAULT_PX)
  const clampCardWidth = useCallback((v: number): number => {
    if (!Number.isFinite(v)) return BOARD_SLIDERS.CARD_WIDTH_DEFAULT_PX
    return Math.min(BOARD_SLIDERS.CARD_WIDTH_MAX_PX, Math.max(BOARD_SLIDERS.CARD_WIDTH_MIN_PX, v))
  }, [])
  const clampCardGap = useCallback((v: number): number => {
    if (!Number.isFinite(v)) return BOARD_SLIDERS.CARD_GAP_DEFAULT_PX
    return Math.min(BOARD_SLIDERS.CARD_GAP_MAX_PX, Math.max(BOARD_SLIDERS.CARD_GAP_MIN_PX, v))
  }, [])
  // Push a snapshot to the undo stack. New user actions clear redoStack
  // (= the "branch when you mutate after an undo" rule, matching every
  // desktop editor).
  const pushUndo = useCallback((entry: UndoEntry, clearRedo: boolean = true): void => {
    setUndoStack((prev) => pushBounded(prev, entry, MAX_UNDO_STACK))
    if (clearRedo) setRedoStack([])
  }, [])

  // Debounced undo capture for the Size / Gap sliders. Continuous drags
  // would spam 60 entries per second otherwise — we instead snapshot the
  // value at the START of a burst and commit one entry after 500ms of
  // quiet, matching how Figma / Sketch coalesce a slider drag into a
  // single undo step.
  const cardWidthDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cardWidthSnapshotRef = useRef<number | null>(null)
  const cardGapDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cardGapSnapshotRef = useRef<number | null>(null)

  const handleCardWidthChange = useCallback(
    (next: number): void => {
      if (cardWidthSnapshotRef.current === null) {
        cardWidthSnapshotRef.current = cardWidthPx
      }
      setCardWidthPx(clampCardWidth(next))
      if (cardWidthDebounceRef.current) clearTimeout(cardWidthDebounceRef.current)
      cardWidthDebounceRef.current = setTimeout(() => {
        const snap = cardWidthSnapshotRef.current
        if (snap !== null) {
          pushUndo({ kind: 'cardWidth', prevWidthPx: snap })
        }
        cardWidthSnapshotRef.current = null
        cardWidthDebounceRef.current = null
      }, 500)
    },
    [cardWidthPx, clampCardWidth, pushUndo],
  )

  const handleCardGapChange = useCallback(
    (next: number): void => {
      if (cardGapSnapshotRef.current === null) {
        cardGapSnapshotRef.current = cardGapPx
      }
      setCardGapPx(clampCardGap(next))
      if (cardGapDebounceRef.current) clearTimeout(cardGapDebounceRef.current)
      cardGapDebounceRef.current = setTimeout(() => {
        const snap = cardGapSnapshotRef.current
        if (snap !== null) {
          pushUndo({ kind: 'cardGap', prevGapPx: snap })
        }
        cardGapSnapshotRef.current = null
        cardGapDebounceRef.current = null
      }, 500)
    },
    [cardGapPx, clampCardGap, pushUndo],
  )

  const handleResetWidthGap = useCallback((): void => {
    setCardWidthPx(BOARD_SLIDERS.CARD_WIDTH_DEFAULT_PX)
    setCardGapPx(BOARD_SLIDERS.CARD_GAP_DEFAULT_PX)
  }, [])

  // Jump both W and G to a preset (DENSE / TIGHT / DEFAULT / OPEN / AMBIENT).
  // Captures a single undo entry holding both prior values so Ctrl+Z restores
  // them together in one step.
  const onApplyPreset = useCallback(
    (id: PresetId): void => {
      const preset = PRESETS.find((p) => p.id === id)
      if (!preset) return
      pushUndo({
        kind: 'tunePreset',
        prevWidthPx: cardWidthPx,
        prevGapPx: cardGapPx,
      })
      setCardWidthPx(clampCardWidth(preset.w))
      setCardGapPx(clampCardGap(preset.g))
    },
    [cardWidthPx, cardGapPx, clampCardWidth, clampCardGap, pushUndo],
  )

  const pip = usePipWindow()
  const handleCardClickFromPip = useCallback((cardId: string) => {
    if (typeof window !== 'undefined') {
      // PiP click is a valid user gesture; Chrome lets us pull the opener tab
      // to the foreground. focusCard handles the case where the card is
      // filtered out of the current view by clearing the filter first.
      window.focus()
      window.dispatchEvent(new CustomEvent('booklage:focus-card', { detail: { cardId } }))
    }
  }, [])
  // Per-card persisted overrides — derived directly from items so the
  // very first render after the IDB load already knows the right widths.
  // The previous useEffect-based hydration created a one-frame flash on
  // reload where every card briefly snapped to the size slider default
  // before the effect populated the override map; useMemo eliminates
  // that flash since it runs in the same render as items.
  const persistentCustomWidths = useMemo<Readonly<Record<string, number>>>(() => {
    const map: Record<string, number> = {}
    for (const it of items) {
      if (it.customCardWidth) map[it.bookmarkId] = it.cardWidth
    }
    return map
  }, [items])

  // Live resize override during an in-flight drag. Holds at most ONE
  // entry (only the actively-dragged card needs it), so it doesn't
  // need a Map. Cleared on pointerup; the optimistic items update
  // inside `persistCustomWidth` carries the new width into
  // persistentCustomWidths in the same React batch.
  const [liveResize, setLiveResize] = useState<{ id: string; width: number } | null>(null)

  // What the layout actually reads — persisted overrides, with the
  // live in-flight width layered on top for the dragging card.
  const customWidths = useMemo<Readonly<Record<string, number>>>(() => {
    if (!liveResize) return persistentCustomWidths
    return { ...persistentCustomWidths, [liveResize.id]: liveResize.width }
  }, [persistentCustomWidths, liveResize])

  const handleCardResize = useCallback((bookmarkId: string, nextWidth: number): void => {
    setLiveResize((prev) => {
      if (prev?.id === bookmarkId && prev.width === nextWidth) return prev
      return { id: bookmarkId, width: nextWidth }
    })
  }, [])

  const handleCardResizeEnd = useCallback(
    (bookmarkId: string, finalWidth: number): void => {
      // Snapshot the pre-resize width so Ctrl+Z can restore it. When the
      // card was using the default size-slider width (customCardWidth=false),
      // undo means "go back to default", not "set this exact pixel value".
      const cur = items.find((it) => it.bookmarkId === bookmarkId)
      if (cur) {
        pushUndo({
          kind: 'resize',
          bookmarkId,
          prevWidth: cur.cardWidth,
          prevCustom: cur.customCardWidth,
        })
      }
      // Clearing liveResize and queueing the optimistic items update
      // in the same task lets React batch them — no flicker between
      // the live drag and the persisted state taking over.
      setLiveResize(null)
      void persistCustomWidth(bookmarkId, finalWidth)
    },
    [persistCustomWidth, items, pushUndo],
  )

  const handleCardResetSize = useCallback(
    (bookmarkId: string): void => {
      setLiveResize((prev) => (prev?.id === bookmarkId ? null : prev))
      void resetCustomWidth(bookmarkId)
    },
    [resetCustomWidth],
  )

  // Ref points at the inner dark canvas — viewport.w/h reflect the canvas's
  // inner dimensions (window minus the outer-frame margin), so masonry layout
  // and culling all work in canvas-local coordinates.
  const canvasRef = useRef<HTMLDivElement>(null)

  // destefanis 流: ページ自体スクロールしない (overflow:hidden)。
  // pan は内部 InteractionLayer のみで担う。board ページから抜けたら復元。
  useEffect(() => {
    if (typeof document === 'undefined') return
    const html = document.documentElement
    const body = document.body
    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = body.style.overflow
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return (): void => {
      html.style.overflow = prevHtmlOverflow
      body.style.overflow = prevBodyOverflow
    }
  }, [])

  // Window-level Space-key tracking for hold-to-pan. Lifted here from
  // InteractionLayer so both InteractionLayer (engagement) and CardsLayer
  // (early-bail in card pointerdown) can read the same state.
  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      if (target.isContentEditable) return true
      return false
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.code !== 'Space') return
      if (isEditableTarget(e.target)) return
      // Prevent default page scroll while Space is held for pan-mode.
      e.preventDefault()
      setSpaceHeld(true)
    }
    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.code !== 'Space') return
      setSpaceHeld(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return (): void => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // Cursor hint while Space is held. Owned here (not InteractionLayer) so the
  // hint matches the lifted state. Always restores on unmount.
  // Also disables native text/element selection on the body so that Space+drag
  // pan never triggers the browser's blue selection rectangle when the drag
  // starts on a card. Uses setProperty/removeProperty to keep types clean and
  // to cover the -webkit- prefixed variant for Safari/older Chrome.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const body = document.body
    if (spaceHeld) {
      body.style.cursor = 'grab'
      body.style.setProperty('user-select', 'none')
      body.style.setProperty('-webkit-user-select', 'none')
    } else {
      body.style.cursor = ''
      body.style.removeProperty('user-select')
      body.style.removeProperty('-webkit-user-select')
    }
    return (): void => {
      body.style.cursor = ''
      body.style.removeProperty('user-select')
      body.style.removeProperty('-webkit-user-select')
    }
  }, [spaceHeld])

  // Hydrate activeFilter and displayMode from persisted BoardConfig.
  useEffect(() => {
    let cancelled = false
    void (async (): Promise<void> => {
      const db = await initDB()
      if (cancelled) return
      const cfg = await loadBoardConfig(db)
      if (cancelled) return
      setActiveFilter(cfg.activeFilter)
      setDisplayMode(cfg.displayMode)
      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
      // A second raw read is intentional: loadBoardConfig spreads DEFAULT_BOARD_CONFIG,
      // so a stored motionEnabled is indistinguishable from the default — only the raw
      // record reveals whether the user ever explicitly persisted a value.
      const rawRecord = await db.get('settings', 'board-config') as { config?: { motionEnabled?: unknown } } | undefined
      if (cancelled) return
      const hasPersisted = typeof rawRecord?.config?.motionEnabled === 'boolean'
      setMotionEnabled(hasPersisted ? cfg.motionEnabled : !prefersReduced)
    })()
    return (): void => { cancelled = true }
  }, [])

  useEffect(() => {
    const update = (): void => {
      const el = canvasRef.current
      if (!el) return
      setViewport((v) => ({ ...v, w: el.clientWidth, h: el.clientHeight }))
    }
    update()
    window.addEventListener('resize', update)
    return (): void => window.removeEventListener('resize', update)
  }, [])

  const filteredItems = useMemo(() => {
    // TRASH (= archive) は items に居ない (soft-deleted は別 state)、
    // deletedItems を直接返す。 これによりカード本体がレンダされる + ×
    // ボタンの handler が BoardRoot 側で restore 意味になる。
    if (activeFilter.kind === 'archive') return deletedItems
    // Tags filter は CardsLayer 側で matchedBookmarkIds + CRT shutdown
    // アニメ経由で表現する (= 非該当カードを items に残しておく → shutdown
    // 演出 → GSAP-FLIP で該当カードが reflow)。 ここで除外してしまうと
    // 演出を発火させる対象が消えるので、 tags の時は全件 (= non-deleted
    // のみ) を通す。 他 kind は従来通り単純絞り込み。
    if (activeFilter.kind === 'tags') return applyFilter(items, BOARD_FILTER_ALL)
    return applyFilter(items, activeFilter)
  }, [items, deletedItems, activeFilter])

  // Tag filter overlay on top of filteredItems. null = no tag filter active
  // (= every card matches). When set, cards whose id is NOT in the set are
  // marked tagged-out: CardsLayer plays the CRT shutdown animation on them
  // and removes them from masonry input so the matched cards reflow naturally
  // via the existing GSAP-FLIP useLayoutEffect.
  const matchedBookmarkIds = useMemo<ReadonlySet<string> | null>(() => {
    if (!isTagsFilter(activeFilter)) return null
    if (activeFilter.tagIds.length === 0) return null
    const tagIds = activeFilter.tagIds
    const mode = activeFilter.mode
    const ids = new Set<string>()
    for (const it of filteredItems) {
      const matches = mode === 'and'
        ? tagIds.every((tid) => it.tags.includes(tid))
        : tagIds.some((tid) => it.tags.includes(tid))
      if (matches) ids.add(it.bookmarkId)
    }
    return ids
  }, [filteredItems, activeFilter])

  const themeMeta = getThemeMeta(DEFAULT_THEME_ID)

  // Cards span the full width of the inner dark canvas with a destefanis-
  // style half-gap on each side (SIDE_PADDING_PX = COLUMN_MASONRY.GAP_PX / 2).
  // No sidebar reservation, no max-width cap — the canvas is the whole stage.
  const effectiveLayoutWidth = Math.max(0, viewport.w - 2 * BOARD_INNER.SIDE_PADDING_PX)

  // Card width slider drives every card's default width directly (px-absolute).
  // Cards that the user has freely resized (`customWidths[id]`) keep their own
  // width — the slider intentionally doesn't override per-card customizations.
  const skylineCards = useMemo<SkylineCard[]>(
    () =>
      filteredItems.map((it) => {
        const w = customWidths[it.bookmarkId] ?? cardWidthPx
        const h = it.aspectRatio > 0 ? w / it.aspectRatio : w
        return { id: it.bookmarkId, width: w, height: h }
      }),
    [filteredItems, cardWidthPx, customWidths],
  )

  const layout = useMemo(
    () =>
      computeSkylineLayout({
        cards: skylineCards,
        containerWidth: effectiveLayoutWidth,
        gap: cardGapPx,
      }),
    [skylineCards, effectiveLayoutWidth, cardGapPx],
  )

  const horizontalOffset = BOARD_INNER.SIDE_PADDING_PX

  // Actual content bounds — tracks the furthest right/bottom any card reaches,
  // using masonry positions (freePos not used in masonry mode) plus overrides
  // that Task 12 will populate during drag-to-reorder.
  // BOARD_TOP_PAD_PX gives the board breathing room at the top so the first
  // row does not collide with the toolbar pill; added to the total so scroll
  // range still reaches cards after the shift in the cards wrapper transform.
  // SCROLL_OVERFLOW_MARGIN adds room below the last card so a user can scroll
  // further down.
  const contentBounds = useMemo(() => {
    let maxRight = 0
    let maxBottom = 0
    for (const it of filteredItems) {
      const p = layout.positions[it.bookmarkId]
      if (!p) continue
      const right = p.x + p.w
      const bottom = p.y + p.h
      if (right > maxRight) maxRight = right
      if (bottom > maxBottom) maxBottom = bottom
    }
    const SCROLL_OVERFLOW_MARGIN = 600
    return {
      width: Math.max(layout.totalWidth, maxRight + SCROLL_OVERFLOW_MARGIN),
      height: Math.max(
        layout.totalHeight + BOARD_TOP_PAD_PX,
        maxBottom + BOARD_TOP_PAD_PX + SCROLL_OVERFLOW_MARGIN,
      ),
    }
  }, [filteredItems, layout.positions, layout.totalWidth, layout.totalHeight])

  const handleScroll = useCallback(
    (dx: number, dy: number): void => {
      markScrollActive()
      setViewport((v) => {
        const maxX = Math.max(0, contentBounds.width - v.w)
        const maxY = Math.max(0, contentBounds.height - v.h)
        return {
          ...v,
          x: Math.min(Math.max(v.x + dx, 0), maxX),
          y: Math.min(Math.max(v.y + dy, 0), maxY),
        }
      })
    },
    [contentBounds.width, contentBounds.height, markScrollActive],
  )

  // Edge auto-scroll hook for useCardReorderDrag. Returns the delta we
  // actually applied after clamping to the content range, so the hook can
  // compensate its worldY formula and keep the dragged card pinned to the
  // pointer while the canvas pans underneath.
  const handlePanY = useCallback(
    (requestedDy: number): number => {
      const v = viewportRef.current
      const maxY = Math.max(0, contentBounds.height - v.h)
      const nextY = Math.min(Math.max(v.y + requestedDy, 0), maxY)
      const actualDy = nextY - v.y
      if (actualDy !== 0) {
        markScrollActive()
        viewportRef.current = { ...v, y: nextY }
        setViewport((prev) => ({ ...prev, y: nextY }))
      }
      return actualDy
    },
    [contentBounds.height, markScrollActive],
  )

  // ScrollMeter click/drag → animated scroll-to-y. requestAnimationFrame loop
  // with easeOutQuint (= 1 - (1-t)^5)。 動き出し即座、 終わりだけ深く
  // 減速して「ふっと止まる」 luxury tail。 session 74 user 検証で「entry
  // anim と同じ Material decelerate 系の curve が気持ちいい、 但し終わり
  // 減速はもう少し強く」 と評価された結果、 cubic decelerate より tail が
  // 強い quint に決定。 業界では Apple App Store 入場 / Stripe checkout
  // slide-in 等で使われる pattern。 旧版 (= Power-30 両端 motionless) の
  // ドラマチック演出は捨てる代わり、 動き出しまでの 540ms 待ちが消える。
  // While the user is actively dragging the meter (multiple onScrollTo
  // calls per frame) we cancel any in-flight tween and snap so the meter
  // tracks the pointer.
  const scrollAnimRef = useRef<number | null>(null)
  const lastJumpAtRef = useRef<number>(0)
  const handleScrollMeterJump = useCallback((targetY: number): void => {
    const now = performance.now()
    const isDragLike = now - lastJumpAtRef.current < 80
    lastJumpAtRef.current = now
    markScrollActive()
    if (scrollAnimRef.current !== null) {
      cancelAnimationFrame(scrollAnimRef.current)
      scrollAnimRef.current = null
    }
    if (isDragLike) {
      setViewport((v) => ({ ...v, y: Math.max(0, Math.min(targetY, contentBounds.height - v.h)) }))
      return
    }
    const startY = viewport.y
    const start = performance.now()
    const distance = Math.abs(targetY - startY)
    // 500ms base + ~60ms per 1000px, capped at 1200ms。 distance 0 → 500ms、
    // distance 5000px → 800ms、 distance 12000px+ → 1200ms。 easeOutQuint
    // は最初 20% で 67% 進むので duration は短くて済む (= 旧 1800ms 基準
    // から大幅短縮)、 但し最後 40% の tail が「気持ちいい減速」 を出す。
    const duration = Math.min(1200, 500 + distance * 0.06)
    // easeOutQuart: 1 - (1 - t)^4。 動き出し急、 終わり 4 次関数で深く減速。
    // session 74 で easeOutQuint (= power 5) から quart (= power 4) に微下げ
    // (user feedback 「動き出しがちょっと急すぎ」 への対応、 最初 20% で
    // 67% → 59% に緩和、 tail keep)。
    const easeOutQuart = (p: number): number => {
      if (p <= 0) return 0
      if (p >= 1) return 1
      return 1 - Math.pow(1 - p, 4)
    }
    const tick = (t: number): void => {
      const p = Math.min(1, (t - start) / duration)
      const eased = easeOutQuart(p)
      markScrollActive()
      setViewport((v) => ({
        ...v,
        y: Math.max(0, Math.min(startY + (targetY - startY) * eased, contentBounds.height - v.h)),
      }))
      if (p < 1) {
        scrollAnimRef.current = requestAnimationFrame(tick)
      } else {
        scrollAnimRef.current = null
      }
    }
    scrollAnimRef.current = requestAnimationFrame(tick)
  }, [viewport.y, contentBounds.height, markScrollActive])

  // Inner scroll-and-glow primitive driven by the layout's stored position
  // for the card, NOT a DOM measurement. CardsLayer culls off-screen cards
  // out of the DOM (perf optimisation), so a DOM lookup at click time will
  // miss any card more than a viewport-buffer away from the current scroll.
  // The layout always knows where the card belongs, regardless of culling.
  const doFocus = useCallback((cardId: string, pos: CardPosition): void => {
    const cardYInCanvas = pos.y + BOARD_TOP_PAD_PX
    const targetY = computeFocusScrollY({
      cardY: cardYInCanvas,
      cardH: pos.h,
      viewportH: viewport.h,
      contentH: contentBounds.height,
    })
    handleScrollMeterJump(targetY)
    // Glow lands after the scroll completes — by then the card is inside
    // the viewport-cull window so it's in the DOM. Match the scroll's
    // distance-scaled duration (see handleScrollMeterJump) and retry a few
    // frames in case React hasn't yet painted the newly-visible card.
    const distance = Math.abs(targetY - viewport.y)
    const scrollDuration = Math.min(1200, 500 + distance * 0.06)
    // Glow fires AFTER the scroll fully settles — never during. Three
    // opacity blinks at 1800ms each (5400ms total) — opacity instead of
    // box-shadow because the latter is invisible on white cards. Tempo
    // is constant regardless of distance.
    window.setTimeout(() => {
      let attempts = 0
      const tryGlow = (): void => {
        const canvas = canvasRef.current
        if (!canvas) return
        const node = canvas.querySelector<HTMLElement>(`[data-card-id="${cardId}"]`)
        if (node) {
          node.setAttribute('data-glowing', 'true')
          window.setTimeout(() => node.removeAttribute('data-glowing'), 5400)
          return
        }
        if (attempts++ < 6) requestAnimationFrame(tryGlow)
      }
      requestAnimationFrame(tryGlow)
    }, scrollDuration + 60)
  }, [viewport.h, viewport.y, contentBounds.height, handleScrollMeterJump])

  // Focus a card by ID — used by ?focus=<cardId> URL param and PiP card click.
  // If the card isn't in the current filter's layout (e.g. user is on a mood
  // filter that excludes the bookmark), clear the filter to 'all' and stash
  // the cardId; the retry useEffect below completes the scroll once
  // layout.positions catches up with the new filteredItems.
  const focusCard = useCallback((cardId: string): void => {
    const pos = layout.positions[cardId]
    if (!pos) {
      setActiveFilter(BOARD_FILTER_ALL)
      setPendingFocusId(cardId)
      return
    }
    doFocus(cardId, pos)
  }, [layout.positions, doFocus])

  // Filter 変化 → 3 つの side-effect:
  //   (1) entryAnimCycle bump で復活カードに CRT bootup アニメ
  //   (2a) tags → 非 tags (= 絞り込み解除) + source 記憶あり → focusCard で
  //        click 元カードの元位置に scroll restore (= source-aware navigation、
  //        探索 mode から元の context に戻る UX pattern)
  //   (2b) tags filter 適用 → 非該当カードの CRT shutdown 演出 (= 550ms +
  //        stagger) を見せ終わってから smooth scroll to top。 即 scroll だと
  //        viewport 外の演出が見えない問題 (session 76 user feedback) の対処。
  //   (2c) その他の filter 変化 (= ALL/INBOX/ARCHIVE dropdown 切替等) → 即
  //        scroll-to-top (shutdown 走らないので待ち不要)。
  // prevRef で初回 mount 時の発火を gate。
  const prevActiveFilterRef = useRef<BoardFilter>(activeFilter)
  const lastClickedSourceRef = useRef<string | null>(null)
  const [entryAnimCycle, setEntryAnimCycle] = useState(0)
  useEffect(() => {
    if (boardFilterEquals(prevActiveFilterRef.current, activeFilter)) return
    const prev = prevActiveFilterRef.current
    prevActiveFilterRef.current = activeFilter
    setEntryAnimCycle((k) => k + 1)

    const isTagsToNonTags = isTagsFilter(prev) && !isTagsFilter(activeFilter)
    const source = lastClickedSourceRef.current
    if (isTagsToNonTags && source) {
      lastClickedSourceRef.current = null
      focusCard(source)
      return
    }

    // tags filter 適用なら shutdown 演出待ち (= 550ms duration + 50ms buffer)。
    // 山場 = 50% 緑 flash 地点 (275ms) → 75% 点化 → 100% 消滅まで見える時間。
    //
    // cleanup を「返さない」 ことが意図的: filteredItems 変化で contentBounds 再計算
    // → handleScrollMeterJump identity 変化 → この effect 再発火 → cleanup で
    // 前 timer kill → 冒頭 boardFilterEquals で early return = scroll 永遠に
    // 発火しないという race を回避する (= session 76 で 1 度踏んだ罠)。
    // 連続 filter click は冒頭の boardFilterEquals で 2 重発火が抑止されるので、
    // 並行 timer 1 個以上は通常発生しない。 仮に並行しても jump(0) が複数走る
    // だけで、 内部 cancelAnimationFrame で最後の発火が勝つ = harmless。
    const isApplyingTagsFilter = isTagsFilter(activeFilter)
    if (isApplyingTagsFilter) {
      window.setTimeout(() => handleScrollMeterJump(0), 600)
      return
    }

    handleScrollMeterJump(0)
  }, [activeFilter, handleScrollMeterJump, focusCard])

  // Retry path — fires after a filter clear when pendingFocusId is set,
  // once layout.positions has the card. layout.positions is in deps so we
  // re-evaluate when filteredItems re-renders.
  useEffect(() => {
    if (!pendingFocusId) return
    const pos = layout.positions[pendingFocusId]
    if (!pos) return
    doFocus(pendingFocusId, pos)
    setPendingFocusId(null)
  }, [pendingFocusId, layout.positions, doFocus])

  // ?focus=<cardId> URL param + booklage:focus-card CustomEvent listener.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const focusId = url.searchParams.get('focus')
    if (focusId) {
      requestAnimationFrame(() => focusCard(focusId))
      url.searchParams.delete('focus')
      window.history.replaceState({}, '', url.toString())
    }
    const evHandler = (e: Event): void => {
      const detail = (e as CustomEvent<{ cardId: string }>).detail
      if (detail?.cardId) focusCard(detail.cardId)
    }
    window.addEventListener('booklage:focus-card', evHandler)
    return () => window.removeEventListener('booklage:focus-card', evHandler)
  }, [focusCard])


  // Shared revalidation queue. Used by both the viewport IntersectionObserver
  // (safety-net cadence) and the Lightbox intent triggers below — keeping a
  // single queue means bounded concurrency (max 3) is global, not per-source.
  // Lazy-initialised on first render; persistLinkStatus/persistThumbnail are
  // stable useCallback([]) so capture-by-closure is safe.
  const revalidateQueueRef = useRef<RevalidationQueue | null>(null)
  if (revalidateQueueRef.current === null) {
    revalidateQueueRef.current = new RevalidationQueue({
      fetcher: defaultFetcher,
      onResult: async (id, r) => {
        const now = Date.now()
        if (r.kind === 'alive') {
          await persistLinkStatus(id, 'alive', now)
          // Heal stale thumbnails when the source changed its og:image —
          // this is what makes the "Lightbox open → see latest" loop close.
          if (r.data?.image) await persistThumbnail(id, r.data.image, true)
        } else if (r.kind === 'gone') {
          await persistLinkStatus(id, 'gone', now)
        }
        // unknown → no state change (will retry on the next intent or viewport entry)
      },
    })
  }

  // Intent-driven revalidate: called when the user signals they care about a
  // specific card (Lightbox open / nav / jump). shouldRevalidate guards on
  // age so most calls are no-ops — fresh records cost nothing.
  const revalidateOnIntent = useCallback((bookmarkId: string): void => {
    const q = revalidateQueueRef.current
    if (!q) return
    const it = items.find((x) => x.bookmarkId === bookmarkId)
    if (!it) return
    if (shouldRevalidate(it.lastCheckedAt, Date.now())) q.enqueue(bookmarkId, it.url)
  }, [items])

  // Wheel-scroll through Lightbox can fire handleLightboxNav 10× per second.
  // Trailing 300ms debounce so only the card the user actually settled on
  // gets a fetch — paging fast through the deck triggers zero traffic.
  const navDebounceRef = useRef<{ id: string | null; timer: number | null }>({ id: null, timer: null })
  const revalidateOnNav = useCallback((bookmarkId: string): void => {
    navDebounceRef.current.id = bookmarkId
    if (navDebounceRef.current.timer !== null) window.clearTimeout(navDebounceRef.current.timer)
    navDebounceRef.current.timer = window.setTimeout(() => {
      const pendingId = navDebounceRef.current.id
      navDebounceRef.current.id = null
      navDebounceRef.current.timer = null
      if (pendingId) revalidateOnIntent(pendingId)
    }, 300)
  }, [revalidateOnIntent])

  const handleCardClick = useCallback((bookmarkId: string, originRect: DOMRect): void => {
    // Block Lightbox open for gone (dead-link) cards — the content is
    // unreachable so opening the Lightbox would only show a broken embed.
    const clickedItem = items.find((it) => it.bookmarkId === bookmarkId)
    if (clickedItem?.linkStatus === 'gone') return
    setLightboxOriginRect(originRect)
    setLightboxItemId(bookmarkId)
    setLightboxSourceItemId(bookmarkId)
    revalidateOnIntent(bookmarkId)
  }, [items, revalidateOnIntent])

  // Card affordance handler. Meaning is context-aware:
  //   - Normal views (ALL / INBOX / tags / DEAD): soft-delete + undo entry
  //   - TRASH view (activeFilter.kind === 'archive'): restore from trash
  // The CardCornerActions component already swaps its icon + label based
  // on the same `inTrash` prop, so user intent and visual match up.
  const handleCardDelete = useCallback((bookmarkId: string): void => {
    if (activeFilter.kind === 'archive') {
      void persistSoftDelete(bookmarkId, false)
      return
    }
    pushUndo({ kind: 'delete', bookmarkId })
    void persistSoftDelete(bookmarkId, true)
  }, [persistSoftDelete, pushUndo, activeFilter])

  // Empty Trash — irreversible bulk hard-delete of every item currently
  // in TRASH. Opens TrashConfirmDialog, which requires a 2-second
  // pointer hold on its DELETE button before the actual purge fires.
  // No-op when the trash is already empty.
  const [trashConfirmOpen, setTrashConfirmOpen] = useState(false)

  /* Right-click context menu for tag deletion. Open targets either the
     FilterPill dropdown's tag rows or the per-card TagIndicatorStrip
     pills — both call openTagContextMenu with viewport coords. The
     DELETE row hands off to tagDeleteConfirm, mirroring the same
     hold-to-delete dialog used in /triage so the gesture vocabulary
     is identical across the app. */
  const [tagContextMenu, setTagContextMenu] = useState<{ tagId: string; x: number; y: number } | null>(null)
  const [tagDeleteConfirm, setTagDeleteConfirm] = useState<{ tagId: string } | null>(null)

  const openTagContextMenu = useCallback((e: { clientX: number; clientY: number }, tagId: string): void => {
    setTagContextMenu({ tagId, x: e.clientX, y: e.clientY })
  }, [])

  /* Bookmark-count lookup for the menu header + dialog body. Counts
     across both active items and TRASH so the number reflects the
     full scope of deleteTagCascade (= scrubs the id regardless of
     isDeleted state). */
  const tagBookmarkCount = useCallback(
    (tagId: string): number => {
      let n = 0
      for (const it of items) if (it.tags.includes(tagId)) n++
      for (const it of deletedItems) if (it.tags.includes(tagId)) n++
      return n
    },
    [items, deletedItems],
  )

  /* Run the cascade: scrub the tag from every bookmark + drop the tag
     record itself, then reload the board state. If the deleted tag is
     part of the active filter, snap back to ALL — keeping a filter
     pinned to a deleted id would render an empty board with no way to
     recover other than a manual dropdown selection. */
  const handleConfirmTagDelete = useCallback(
    async (tagId: string): Promise<void> => {
      await removeTag(tagId)
      await reload()
      if (isTagsFilter(activeFilter) && activeFilter.tagIds.includes(tagId)) {
        setActiveFilter(BOARD_FILTER_ALL)
      }
      setTagDeleteConfirm(null)
    },
    [removeTag, reload, activeFilter],
  )
  const handleEmptyTrashRequest = useCallback((): void => {
    if (deletedItems.length === 0) return
    setTrashConfirmOpen(true)
  }, [deletedItems.length])
  const handleEmptyTrashConfirm = useCallback(async (): Promise<void> => {
    setTrashConfirmOpen(false)
    await emptyTrash()
  }, [emptyTrash])

  // Tag mutation handlers. Phase 1: simple reload-after-mutation. A later
  // pass can swap in optimistic state updates if perceived latency is bad
  // on slow devices; for now ~50ms reload feels fine on desktop.
  const handleTagToggle = useCallback(
    async (bookmarkId: string, tagId: string): Promise<void> => {
      const item = items.find((it) => it.bookmarkId === bookmarkId)
      if (!item) return
      const db = await initDB()
      if (item.tags.includes(tagId)) {
        await removeTagFromBookmark(db, bookmarkId, tagId)
      } else {
        await addTagToBookmark(db, bookmarkId, tagId)
      }
      await reload()
    },
    [items, reload],
  )

  const handleTagCreate = useCallback(
    async (bookmarkId: string, name: string): Promise<void> => {
      const trimmed = name.trim()
      if (!trimmed) return
      const db = await initDB()
      // Reuse an existing tag with the same name if one already exists —
      // case-insensitive — so the new-input pathway doesn't silently create
      // duplicates of "YouTube" / "youtube" etc.
      const existing = tags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase())
      const target = existing ?? (await addTag(db, { name: trimmed, color: '#28F100', order: tags.length }))
      await addTagToBookmark(db, bookmarkId, target.id)
      await reloadTags()
      await reload()
    },
    [tags, reload, reloadTags],
  )

  // Card width and gap are board-wide preferences, not per-card data.
  // localStorage is sufficient (recovers on next visit, cross-device sync
  // not in scope). On mount we hydrate from saved values once.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedW = window.localStorage.getItem('booklage:card-width-px')
    if (savedW !== null) setCardWidthPx(clampCardWidth(Number(savedW)))
    const savedG = window.localStorage.getItem('booklage:card-gap-px')
    if (savedG !== null) setCardGapPx(clampCardGap(Number(savedG)))
  }, [clampCardWidth, clampCardGap])
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('booklage:card-width-px', String(cardWidthPx))
  }, [cardWidthPx])
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('booklage:card-gap-px', String(cardGapPx))
  }, [cardGapPx])

  // Fired by Lightbox at the moment .media has landed at the source
  // card's rect, ~150ms BEFORE the lightbox actually unmounts. Restoring
  // visibility now means the source card is visible underneath while
  // .media fades out on top — the cross-fade window that masks the
  // visual mismatch between .media's <img> and the source card's <img>
  // (different object-fit, radius). See Lightbox close-tween comment.
  const handleLightboxSourceShouldShow = useCallback((): void => {
    setLightboxSourceItemId(null)
  }, [])

  const handleLightboxClose = useCallback((): void => {
    setLightboxItemId(null)
    // sourceItemId should already be null via the cross-fade callback
    // above, but clear defensively in case the callback path was skipped
    // (fallback close, no source card, etc.).
    setLightboxSourceItemId(null)
    setLightboxOriginRect(null)
  }, [])

  // Nav scope = filteredItems (what's currently visible on canvas).
  // Items found only in `items` (e.g. archived, filtered-out) are not
  // nav-reachable from the lightbox — that matches the user's mental
  // model: "I'm browsing what I see".
  const lightboxIndex = useMemo(
    () => filteredItems.findIndex((it) => it.bookmarkId === lightboxItemId),
    [filteredItems, lightboxItemId],
  )
  const lightboxItem = lightboxIndex >= 0 ? filteredItems[lightboxIndex] : null

  const handleLightboxNav = useCallback((dir: -1 | 1): void => {
    if (filteredItems.length === 0 || lightboxIndex < 0) return
    const next = ((lightboxIndex + dir) % filteredItems.length + filteredItems.length) % filteredItems.length
    const nextId = filteredItems[next]?.bookmarkId ?? null
    setLightboxItemId(nextId)
    if (nextId) revalidateOnNav(nextId)
    // Source id and origin rect are NOT touched here — close always
    // returns to the originally clicked card regardless of how many
    // chevron-navs the user performed in between (B-#11).
  }, [filteredItems, lightboxIndex, revalidateOnNav])

  const handleLightboxJump = useCallback((index: number): void => {
    if (index < 0 || index >= filteredItems.length) return
    const nextId = filteredItems[index]?.bookmarkId ?? null
    setLightboxItemId(nextId)
    if (nextId) revalidateOnIntent(nextId)
    // Source id / origin rect preserved — see handleLightboxNav (B-#11).
  }, [filteredItems, revalidateOnIntent])

  const handleDropOrder = useCallback(
    (orderedBookmarkIds: readonly string[]): void => {
      // Snapshot the pre-drop order so Ctrl+Z restores it.
      const prevOrder = items.map((it) => ({
        id: it.bookmarkId,
        orderIndex: it.orderIndex,
      }))
      pushUndo({ kind: 'reorder', prev: prevOrder })
      void persistOrderBatch(orderedBookmarkIds)
    },
    [persistOrderBatch, items, pushUndo],
  )

  // ---- Undo / Redo system ----
  //
  // Detect user-added bookmarks by diffing the items id set against the
  // previous render. Initial hydrate (prevItemIdsRef === null) is not
  // counted as a user action. Suppressed while applying an undo / redo
  // so the resulting items mutation does not register as a new add.
  useEffect(() => {
    if (loading) return
    const curIds = new Set(items.map((it) => it.bookmarkId))
    if (prevItemIdsRef.current === null) {
      prevItemIdsRef.current = curIds
      return
    }
    if (suppressItemDetectRef.current) {
      prevItemIdsRef.current = curIds
      return
    }
    const prev = prevItemIdsRef.current
    const added: string[] = []
    for (const id of curIds) {
      if (!prev.has(id)) added.push(id)
    }
    if (added.length > 0) {
      pushUndo({ kind: 'add', bookmarkIds: added })
    }
    prevItemIdsRef.current = curIds
  }, [items, loading, pushUndo])

  const applyEntry = useCallback(
    async (entry: UndoEntry, direction: 'undo' | 'redo'): Promise<void> => {
      suppressItemDetectRef.current = true
      let inverse: UndoEntry | null = null
      let messageKey = ''

      try {
        switch (entry.kind) {
          case 'reorder': {
            const cur = items.map((it) => ({
              id: it.bookmarkId,
              orderIndex: it.orderIndex,
            }))
            inverse = { kind: 'reorder', prev: cur }
            // Filter out ids no longer in items (e.g. deleted since the
            // snapshot was taken) so persistOrderBatch sees a valid list.
            const liveIds = new Set(items.map((it) => it.bookmarkId))
            const ordered = [...entry.prev]
              .filter((p) => liveIds.has(p.id))
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((p) => p.id)
            if (ordered.length > 0) await persistOrderBatch(ordered)
            messageKey = `${direction}.reorder`
            break
          }
          case 'delete': {
            inverse = { kind: 'delete', bookmarkId: entry.bookmarkId }
            await persistSoftDelete(entry.bookmarkId, false)
            messageKey = `${direction}.delete`
            break
          }
          case 'resize': {
            const curItem = items.find(
              (it) => it.bookmarkId === entry.bookmarkId,
            )
            if (curItem) {
              inverse = {
                kind: 'resize',
                bookmarkId: entry.bookmarkId,
                prevWidth: curItem.cardWidth,
                prevCustom: curItem.customCardWidth,
              }
            }
            if (entry.prevCustom) {
              await persistCustomWidth(entry.bookmarkId, entry.prevWidth)
            } else {
              await resetCustomWidth(entry.bookmarkId)
            }
            messageKey = `${direction}.resize`
            break
          }
          case 'add': {
            inverse = { kind: 'add', bookmarkIds: entry.bookmarkIds }
            for (const id of entry.bookmarkIds) {
              await persistSoftDelete(id, true)
            }
            messageKey = `${direction}.add`
            break
          }
          case 'cardWidth': {
            inverse = { kind: 'cardWidth', prevWidthPx: cardWidthPx }
            setCardWidthPx(clampCardWidth(entry.prevWidthPx))
            messageKey = `${direction}.cardWidth`
            break
          }
          case 'cardGap': {
            inverse = { kind: 'cardGap', prevGapPx: cardGapPx }
            setCardGapPx(clampCardGap(entry.prevGapPx))
            messageKey = `${direction}.cardGap`
            break
          }
          case 'tunePreset': {
            inverse = {
              kind: 'tunePreset',
              prevWidthPx: cardWidthPx,
              prevGapPx: cardGapPx,
            }
            setCardWidthPx(clampCardWidth(entry.prevWidthPx))
            setCardGapPx(clampCardGap(entry.prevGapPx))
            messageKey = `${direction}.tunePreset`
            break
          }
        }
      } finally {
        // Re-enable add detection after the items mutation has had a
        // chance to flow through. 200ms is generous — the IDB writes
        // above are usually < 30ms.
        setTimeout(() => {
          suppressItemDetectRef.current = false
        }, 200)
      }

      const inv = inverse
      if (inv) {
        if (direction === 'undo') {
          setRedoStack((prev) => pushBounded(prev, inv, MAX_UNDO_STACK))
        } else {
          setUndoStack((prev) => pushBounded(prev, inv, MAX_UNDO_STACK))
        }
      }

      if (messageKey) {
        setToast({ message: t(messageKey), nonce: Date.now() })
      }
    },
    [
      items,
      persistOrderBatch,
      persistSoftDelete,
      persistCustomWidth,
      resetCustomWidth,
      cardWidthPx,
      cardGapPx,
      clampCardWidth,
      clampCardGap,
    ],
  )

  // Global Ctrl/Cmd+Z (undo) and Ctrl/Cmd+Shift+Z (redo). Ignored when the
  // user is typing in an input/textarea/contenteditable so native browser
  // undo still works for text fields.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key.toLowerCase() !== 'z') return
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      e.preventDefault()
      if (e.shiftKey) {
        const stack = redoStackRef.current
        if (stack.length === 0) return
        const entry = stack[stack.length - 1]!
        setRedoStack((prev) => prev.slice(0, -1))
        void applyEntry(entry, 'redo')
      } else {
        const stack = undoStackRef.current
        if (stack.length === 0) return
        const entry = stack[stack.length - 1]!
        setUndoStack((prev) => prev.slice(0, -1))
        void applyEntry(entry, 'undo')
      }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [applyEntry])

  const handleDisplayModeChange = useCallback((m: DisplayMode): void => {
    setDisplayMode(m)
    void (async (): Promise<void> => {
      const db = await initDB()
      const cfg = await loadBoardConfig(db)
      await saveBoardConfig(db, { ...cfg, displayMode: m })
    })()
  }, [])

  const handleFilterChange = useCallback((f: BoardFilter): void => {
    setActiveFilter(f)
    void (async (): Promise<void> => {
      const db = await initDB()
      const cfg = await loadBoardConfig(db)
      await saveBoardConfig(db, { ...cfg, activeFilter: f })
    })()
  }, [])

  const handleToggleMotion = useCallback((): void => {
    setMotionEnabled((prev) => {
      const next = !prev
      void (async (): Promise<void> => {
        const db = await initDB()
        const cfg = await loadBoardConfig(db)
        await saveBoardConfig(db, { ...cfg, motionEnabled: next })
      })()
      return next
    })
  }, [])

  const handleOpenBookmarkletModal = useCallback((): void => {
    setBookmarkletModalOpen(true)
  }, [])
  const handleCloseBookmarkletModal = useCallback((): void => {
    setBookmarkletModalOpen(false)
  }, [])

  // Phase 3 share rebuild (Task 15): build the v2 share payload from the
  // current board view (= filtered visible items + relevant tag dict +
  // active tags filter). Called lazily by SenderShareModal on open.
  const buildShareData = useCallback((): ShareDataV2 => {
    return buildShareDataFromBoard({
      items: filteredItems.map((it) => ({
        bookmarkId: it.bookmarkId,
        url: it.url,
        title: it.title,
        description: it.description ?? undefined,
        thumbnail: it.thumbnail ?? undefined,
        aspectRatio: it.aspectRatio,
        tags: it.tags,
        cardWidth: customWidths[it.bookmarkId] ?? cardWidthPx,
      })),
      tags: tags.map((tg) => ({ id: tg.id, name: tg.name, color: tg.color })),
      filter: activeFilter.kind === 'tags'
        ? { mode: activeFilter.mode, tagIds: activeFilter.tagIds }
        : null,
      now: Date.now(),
    })
  }, [filteredItems, tags, activeFilter, customWidths, cardWidthPx])

  // Phase B: rate-limit-driven backfill for every tweet bookmark. Replaces
  // the prior sequential loop (which persisted thumbnail + hasVideo). The
  // new path also persists mediaSlots from the same fetchTweetMeta call
  // (no extra API trips). Uses createBackfillQueue at parallel-3 +
  // 200ms intervals (spec §4-2 B-3) and an AbortController so navigation
  // away during a long sweep cancels in-flight tasks cleanly.
  //
  // processedTweetIdsRef dedupes across items.length re-fires so a freshly
  // arrived bookmark only enqueues if its tweet id has never been touched
  // in this session.
  const processedTweetIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (loading || items.length === 0) return
    const controller = new AbortController()
    const queue = createBackfillQueue({
      maxConcurrent: 3,
      minIntervalMs: 200,
      signal: controller.signal,
    })
    for (const it of items) {
      if (detectUrlType(it.url) !== 'tweet') continue
      const tweetId = extractTweetId(it.url)
      if (!tweetId) continue
      if (processedTweetIdsRef.current.has(tweetId)) continue
      // Spec §B-2 visible filter: items[] is already the post-filter,
      // post-soft-delete set produced by useBoardData. Iterating it
      // satisfies the "visible カード限定" requirement.
      processedTweetIdsRef.current.add(tweetId)
      void queue.add((signal) =>
        backfillTweetMeta(
          { bookmarkId: it.bookmarkId, tweetId },
          signal,
          {
            fetchMeta: fetchTweetMeta,
            persistThumbnail,
            persistVideoFlag,
            persistMediaSlots,
            persistTitle,
          },
        ),
      ).catch(() => {
        /* per-target failure isolated by the queue; nothing to do here. */
      })
    }
    return (): void => { controller.abort() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, items.length, persistThumbnail, persistVideoFlag, persistMediaSlots, persistTitle])

  // TikTok thumbnail backfill via the public oEmbed endpoint
  // (https://www.tiktok.com/oembed?url=...). The bookmarklet's og:image
  // capture often gets the generic TikTok-logo card instead of a real
  // video first-frame because tiktok.com is a SPA, identical to the X
  // tweet problem. oEmbed returns a `thumbnail_url` that points at the
  // video's actual cover image (CDN), so we overwrite bookmark.thumbnail
  // with force=true on every TikTok item the first time we see it.
  // processedTikTokIdsRef dedupes the same way as the tweet pipeline so
  // we don't re-fetch when items.length re-fires the effect.
  const processedTikTokIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (loading || items.length === 0) return
    let cancelled = false
    const sleep = (ms: number): Promise<void> =>
      new Promise((resolve) => setTimeout(resolve, ms))
    void (async (): Promise<void> => {
      for (const it of items) {
        if (cancelled) return
        if (detectUrlType(it.url) !== 'tiktok') continue
        if (processedTikTokIdsRef.current.has(it.bookmarkId)) continue
        processedTikTokIdsRef.current.add(it.bookmarkId)
        try {
          const meta = await fetchTikTokMeta(it.url)
          if (cancelled) return
          if (!meta?.thumbnailUrl) continue
          await persistThumbnail(it.bookmarkId, meta.thumbnailUrl, true)
        } catch {
          /* swallow per-item failures; the next item still tries */
        }
        if (cancelled) return
        await sleep(200)
      }
    })()
    return (): void => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, items.length, persistThumbnail])

  // BroadcastChannel: reload board and trigger entrance animation when a new
  // bookmark is saved via the bookmarklet popup (/save route).
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const unsub = subscribeBookmarkSaved(async ({ bookmarkId }) => {
      await reload()
      setNewlyAddedIds((prev) => {
        const next = new Set(prev)
        next.add(bookmarkId)
        return next
      })
      // Clear the "new" flag after entrance animation completes
      const id = setTimeout(() => {
        setNewlyAddedIds((prev) => {
          const next = new Set(prev)
          next.delete(bookmarkId)
          return next
        })
      }, 800)
      timers.push(id)
    })
    return (): void => {
      unsub()
      for (const t of timers) clearTimeout(t)
    }
  }, [reload])

  // Viewport-driven revalidation: when a card enters the viewport, check
  // whether its link is still alive if it hasn't been checked recently
  // (REVALIDATE_AGE_MS). Reuses the shared revalidateQueueRef so global
  // concurrency stays bounded. Lightbox intent triggers are the primary
  // freshness path; this is the safety net for cards never opened.
  useEffect(() => {
    if (!items.length) return
    const queue = revalidateQueueRef.current
    if (!queue) return

    const observer = new IntersectionObserver(
      (entries) => {
        const now = Date.now()
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const id = (e.target as HTMLElement).dataset.bookmarkId
          if (!id) continue
          const item = items.find((it) => it.bookmarkId === id)
          if (!item) continue
          if (shouldRevalidate(item.lastCheckedAt, now)) {
            queue.enqueue(id, item.url)
          }
        }
      },
      { rootMargin: '200px' },
    )

    for (const it of items) {
      const el = document.querySelector(`[data-bookmark-id="${it.bookmarkId}"]`)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [items])

  const sidebarCounts = useMemo(() => {
    // items is already the active (= non-deleted) set; deletedItems
    // is the parallel TRASH-only state. Counting items.isDeleted would
    // always yield 0 since useBoardData filters them out before render.
    return {
      all: items.length,
      inbox: items.filter((i) => i.tags.length === 0).length,
      archive: deletedItems.length,
      dead: items.filter((i) => i.linkStatus === 'gone').length,
    }
  }, [items, deletedItems])

  const contentWidth = Math.max(viewport.w, contentBounds.width)
  const contentHeight = Math.max(viewport.h, contentBounds.height)

  // Visible card range [N1, N2] for the ScrollMeter counter readout. Naturally
  // 60Hz-throttled: viewport state updates once per scroll event (React
  // batches within a frame), so this useMemo recomputes once per frame.
  // Cards are laid out by skyline (not strictly y-sorted across columns),
  // so we sweep the full filteredItems list and track first/last visible
  // index. The card's screen-space top in canvasWrap coords is
  // `BOARD_TOP_PAD_PX + pos.y - viewport.y` — visible if that intersects
  // [0, viewport.h].
  const visibleRange = useMemo<{ start: number; end: number }>(() => {
    if (filteredItems.length === 0) return { start: 0, end: 0 }
    let firstIdx = -1
    let lastIdx = -1
    for (let i = 0; i < filteredItems.length; i++) {
      const item = filteredItems[i]
      if (!item) continue
      const pos = layout.positions[item.bookmarkId]
      if (!pos) continue
      const cardTop = BOARD_TOP_PAD_PX + pos.y - viewport.y
      const cardBottom = cardTop + pos.h
      if (cardBottom > 0 && cardTop < viewport.h) {
        if (firstIdx === -1) firstIdx = i
        lastIdx = i
      }
    }
    return {
      start: firstIdx >= 0 ? firstIdx + 1 : 0,
      end: lastIdx >= 0 ? lastIdx + 1 : 0,
    }
  }, [filteredItems, layout.positions, viewport.y, viewport.h])

  // Session 39 phase 6 (B-#20 refactor): compute everything ScrollMeter needs
  // from the current Lightbox / scroll state. Single source of truth for the
  // meter's mode + content — ScrollMeter just renders.
  // `lightboxIndex < 0` (= the open card vanished from the current filter)
  // falls back to board mode so the meter doesn't show stale lightbox data.
  const isLightboxMode = lightboxItemId !== null && lightboxIndex >= 0
  const meterMode: 'board' | 'lightbox' = isLightboxMode ? 'lightbox' : 'board'
  const meterN1 = isLightboxMode ? lightboxIndex + 1 : visibleRange.start
  const meterN2 = isLightboxMode ? lightboxIndex + 1 : visibleRange.end
  const meterScrollableHeight = Math.max(0, contentBounds.height - viewport.h)
  const meterSwellFraction = isLightboxMode
    ? (filteredItems.length > 1 ? lightboxIndex / (filteredItems.length - 1) : 0)
    : (meterScrollableHeight > 0 ? viewport.y / meterScrollableHeight : 0)

  // Parent-side scrub translator: ScrollMeter sends a 0..1 fraction at most
  // once per frame; we translate to mode-appropriate action (= scroll-to-y
  // in board mode, jump-to-card in lightbox mode).
  const handleMeterScrub = useCallback((fraction: number): void => {
    if (isLightboxMode) {
      const lastIdx = Math.max(0, filteredItems.length - 1)
      const idx = Math.max(0, Math.min(lastIdx, Math.round(fraction * lastIdx)))
      handleLightboxJump(idx)
    } else {
      const y = Math.max(0, fraction * meterScrollableHeight)
      handleScrollMeterJump(y)
    }
  }, [isLightboxMode, filteredItems.length, handleLightboxJump, handleScrollMeterJump, meterScrollableHeight])

  return (
    <div className={styles.outerFrame}>
      {/* Outer-frame chrome — wordmark (top-left) + link strip (bottom).
          Sits in the white margin around the dark canvas, gives users a way
          back to the marketing site without intruding on the board.
          Session 30: 全画面化 sprint で一時非表示。 余白がなくなり居場所を失った
          ため、 footer 全体デザイン (= 広告含む) を別 sprint で再設計してから
          差し戻す。 復活させるには下行のコメントアウトを外す。 */}
      {/* <BoardChrome /> */}
      {/* Provisional onboarding affordance for early testers — drag the
          pill into the browser bookmark bar to install AllMarks. Revisit
          once the marketing site handles install on its own. */}
      <BookmarkletPill />
      {/* MOTION switch + active-filter readout live in the outer frame's TOP
          BAND (the empty margin above the canvas), right edge aligned to the
          canvas action row's SHARE button. Placing them here — OUTSIDE the
          canvas, which clips its own overflow — lets them sit ABOVE the
          TUNE/POP OUT/SHARE row without ever shifting it (user requirement).
          Fades out with the rest of the chrome while the Lightbox is open. */}
      <div
        className={lightboxItemId ? `${styles.frameTopChrome} ${styles.frameTopChromeHidden}` : styles.frameTopChrome}
        aria-hidden={lightboxItemId ? 'true' : undefined}
      >
        <MotionToggle enabled={motionEnabled} onToggle={handleToggleMotion} />
        <FilterPill
          value={activeFilter}
          onChange={handleFilterChange}
          tags={tags}
          counts={sidebarCounts}
          tagsMatchCount={isTagsFilter(activeFilter) ? matchedBookmarkIds?.size ?? 0 : undefined}
          onTagContextMenu={openTagContextMenu}
          activeContextTagId={tagContextMenu?.tagId ?? tagDeleteConfirm?.tagId ?? null}
        />
      </div>
      {/* Inner dark canvas — destefanis-style stage. The whole pan/cards/
          live inside, so cursor pan never escapes the rounded frame.
          Phase 1A: canvas is now a grid (auto / 1fr) — TopHeader at top,
          canvasWrap holds the existing absolute-layered scroll/cards stage. */}
      <div className={styles.canvas}>
        <TopHeader
          hidden={!!lightboxItemId}
          actions={
            <>
              <TuneTrigger
                widthPx={cardWidthPx}
                gapPx={cardGapPx}
                onChangeWidth={handleCardWidthChange}
                onChangeGap={handleCardGapChange}
                onReset={handleResetWidthGap}
                onApplyPreset={onApplyPreset}
              />
              <TagButton
                onClick={(): void => {
                  // Session 81: entry picker removed. TriagePage now auto-
                  // selects mode based on the untagged backlog (= empty
                  // backlog → 'all' so the user can review existing tags,
                  // otherwise → 'untagged'). A single-tag board filter
                  // still passes through with its mode so the user keeps
                  // their cohort context.
                  if (activeFilter.kind === 'tags' && activeFilter.tagIds.length === 1) {
                    router.push(`/triage?mode=tag:${activeFilter.tagIds[0]}`)
                  } else {
                    router.push('/triage')
                  }
                }}
              />
              <ChromeButton
                label={t('board.chrome.popout')}
                onClick={() => { void pip.open() }}
                disabled={!pip.isSupported}
                data-testid="pop-out-button"
              />
              <ChromeButton
                label={t('board.chrome.share')}
                onClick={(): void => setShareModalOpen(true)}
                data-testid="share-pill"
              />
              {activeFilter.kind === 'archive' && deletedItems.length > 0 && (
                <ChromeButton
                  label="EMPTY TRASH"
                  onClick={handleEmptyTrashRequest}
                  data-testid="empty-trash-button"
                />
              )}
            </>
          }
        />
        <div ref={canvasRef} className={styles.canvasWrap} data-lightbox-clone-host>
          <InteractionLayer
            direction={themeMeta.direction}
            onScroll={handleScroll}
            spaceHeld={spaceHeld}
          >
            {/* Background — full canvas coverage, follows scroll. */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transform: `translate3d(${-viewport.x}px, ${-viewport.y}px, 0)`,
                willChange: 'transform',
                pointerEvents: 'none',
              }}
            >
              <ThemeLayer
                themeId={DEFAULT_THEME_ID}
                totalWidth={contentWidth}
                totalHeight={contentHeight}
              />
            </div>
            {/* Hero background typography — viewport-bound (does NOT live
                inside the pan-transform wrappers above), so the headline
                stays centred on screen while cards travel over it. The
                cards-wrapper that follows in DOM order establishes its
                own stacking context via translate3d, and since the
                typography host carries no explicit z-index, DOM order
                alone keeps the cards above the typography. */}
            <BoardBackgroundTypography
              activeFilter={activeFilter}
              tags={tags}
              variant={bgTypoVariant}
            />
            {/* Cards — full-canvas-width with destefanis half-gap padding.
                Vertical transform adds BOARD_TOP_PAD_PX so the first row gets
                breathing room below the canvas top edge / toolbar pill. */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transform: `translate3d(${horizontalOffset - viewport.x}px, ${BOARD_TOP_PAD_PX - viewport.y}px, 0)`,
                willChange: 'transform',
                pointerEvents: 'none',
              }}
            >
              <CardsLayer
                items={filteredItems}
                viewport={viewport}
                viewportWidth={effectiveLayoutWidth}
                cardGapPx={cardGapPx}
                hoveredBookmarkId={hoveredBookmarkId}
                audioActiveId={audioActiveId}
                onToggleAudio={handleToggleAudio}
                audioVolume={audioVolume}
                audioPaused={audioPaused}
                onAudioVolumeChange={setAudioVolume}
                onAudioTogglePause={handleAudioTogglePause}
                spaceHeld={spaceHeld}
                onHoverChange={setHoveredBookmarkId}
                onClick={handleCardClick}
                onDrop={handleDropOrder}
                onDelete={handleCardDelete}
                inTrash={activeFilter.kind === 'archive'}
                persistMeasuredAspect={persistMeasuredAspect}
                displayMode={displayMode}
                newlyAddedIds={newlyAddedIds}
                defaultCardWidth={cardWidthPx}
                customWidths={customWidths}
                onCardResize={handleCardResize}
                onCardResizeEnd={handleCardResizeEnd}
                onCardResetSize={handleCardResetSize}
                sourceCardId={lightboxSourceItemId}
                onPanY={handlePanY}
                motionEnabled={motionEnabled}
                matchedBookmarkIds={matchedBookmarkIds}
                allTags={tags}
                onTagToggle={handleTagToggle}
                onTagCreate={handleTagCreate}
                onTagFilterToggle={(tagId, sourceBookmarkId): void => {
                  // カードのタグピル click 時の source bookmarkId を memo。
                  // 解除時の useEffect で focusCard に渡して元 scroll 位置に
                  // 戻す source-aware navigation を実現する (= dropdown 経由
                  // の filter 変化は sourceBookmarkId undefined なので
                  // scroll-to-top に流れる、 既存挙動と互換)。
                  if (sourceBookmarkId) lastClickedSourceRef.current = sourceBookmarkId
                  handleFilterChange(toggleTagInFilter(activeFilter, tagId))
                }}
                onTagContextMenu={openTagContextMenu}
                activeContextTagId={tagContextMenu?.tagId ?? tagDeleteConfirm?.tagId ?? null}
                isScrolling={isScrolling}
                entryAnimCycle={entryAnimCycle}
              />
            </div>
          </InteractionLayer>
          {!loading && items.length === 0 && (
            <EmptyStateWelcome onOpenModal={handleOpenBookmarkletModal} />
          )}
        </div>
        {/* Session 39 phase 6 (B-#20 refactor): single unified meter for
            both board and Lightbox states. Earlier multi-component +
            crossfade approach (phase 1-5) collapsed into ONE ScrollMeter
            that swaps its content via mode prop. The bulge eases between
            scroll-fraction and card-fraction targets via ease-in-out tween
            on mode change AND on lightbox-mode card swaps. No slot
            wrapper, no freeze refs, no glide-arm React state — all the
            transition logic lives inside ScrollMeter itself. */}
        <ScrollMeter
          mode={meterMode}
          n1={meterN1}
          n2={meterN2}
          total={filteredItems.length}
          swellFraction={meterSwellFraction}
          onScrub={handleMeterScrub}
        />
        {/* Lightbox is a sibling of TopHeader + canvasWrap, NOT a child of
            canvasWrap. This way its backdrop (position: absolute; inset: 0)
            fills the FULL canvas — including the TopHeader band — so the
            lightbox visually centers within the entire dark canvas instead
            of the area below the TopHeader. The canvas's own overflow:hidden
            + border-radius still clip the backdrop to the rounded stage.
            TopHeader is faded out while the lightbox is open (see
            `hidden={!!lightboxItemId}` above) so the close button at the
            backdrop's top-right corner doesn't collide with header chrome. */}
        <Lightbox
          item={lightboxItem}
          originRect={lightboxOriginRect}
          sourceCardId={lightboxSourceItemId}
          onSourceShouldShow={handleLightboxSourceShouldShow}
          onClose={handleLightboxClose}
          nav={lightboxItem ? {
            currentIndex: lightboxIndex,
            total: filteredItems.length,
            onNav: handleLightboxNav,
            onJump: handleLightboxJump,
          } : undefined}
          persistMediaSlots={persistMediaSlots}
        />
      </div>
      {/* Modals stay viewport-level so they cover everything including
          the outer margin (different visual treatment from Lightbox). */}
      <BookmarkletInstallModal
        isOpen={bookmarkletModalOpen}
        onClose={handleCloseBookmarkletModal}
        appUrl={typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL ?? 'https://booklage.pages.dev')}
      />
      <SenderShareModal
        open={shareModalOpen}
        onClose={(): void => setShareModalOpen(false)}
        getShareData={buildShareData}
        totalBoardCount={filteredItems.length}
        scrollY={viewport.y}
        contentHeight={contentBounds.height}
        viewportHeight={viewport.h}
        activeTagNames={isTagsFilter(activeFilter)
          ? activeFilter.tagIds.flatMap((id): string[] => {
              const tag = tags.find((t) => t.id === id)
              return tag ? [tag.name] : []
            })
          : []}
        onPanY={(dy: number): void => { handlePanY(dy) }}
        items={filteredItems.map((it): MirrorItem => ({
          id: it.bookmarkId,
          url: it.url,
          title: it.title,
          thumbnailUrl: it.thumbnail ?? null,
        }))}
        positions={Object.entries(layout.positions).map(([id, p]): MirrorPosition => ({
          id,
          x: p.x,
          y: p.y,
          w: p.w,
          h: p.h,
        }))}
        bgViewportWidth={viewport.w}
      />
      {trashConfirmOpen && (
        <TrashConfirmDialog
          count={deletedItems.length}
          onConfirm={(): void => { void handleEmptyTrashConfirm() }}
          onCancel={(): void => setTrashConfirmOpen(false)}
        />
      )}
      {/* Tag right-click context menu (board side). Open from FilterPill
          dropdown rows or per-card TagIndicatorStrip pills. Targeted tag
          is looked up live so the menu vanishes if the tag is removed
          from another tab while open. */}
      {tagContextMenu && (() => {
        const targetTag = tags.find((tg) => tg.id === tagContextMenu.tagId)
        if (!targetTag) return null
        return (
          <TagContextMenu
            x={tagContextMenu.x}
            y={tagContextMenu.y}
            tagName={targetTag.name}
            bookmarkCount={tagBookmarkCount(targetTag.id)}
            onDelete={(): void => {
              setTagDeleteConfirm({ tagId: targetTag.id })
              setTagContextMenu(null)
            }}
            onClose={(): void => setTagContextMenu(null)}
          />
        )
      })()}
      {tagDeleteConfirm && (() => {
        const targetTag = tags.find((tg) => tg.id === tagDeleteConfirm.tagId)
        if (!targetTag) return null
        return (
          <TagDeleteConfirmDialog
            tagName={targetTag.name}
            bookmarkCount={tagBookmarkCount(targetTag.id)}
            onConfirm={(): void => { void handleConfirmTagDelete(targetTag.id) }}
            onCancel={(): void => setTagDeleteConfirm(null)}
          />
        )
      })()}
      <PipPortal pipWindow={pip.window}>
        <PipCompanion
          onClose={() => pip.close()}
          onCardClick={handleCardClickFromPip}
        />
      </PipPortal>
      <UndoToast input={toast} />
    </div>
  )
}
