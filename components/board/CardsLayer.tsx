'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { gsap } from 'gsap'
import { computeSkylineLayout, type SkylineCard } from '@/lib/board/skyline-layout'
import type { CardPosition, DisplayMode, ThemeId } from '@/lib/board/types'
import {
  BOARD_Z_INDEX,
  CULLING,
} from '@/lib/board/constants'
import { PRESETS } from '@/lib/board/tune-presets'
import type { BoardItem } from '@/lib/storage/use-board-data'
import { detectUrlType, isInstagramReel, safeExternalUrl } from '@/lib/utils/url'
import { getThemeMeta } from '@/lib/board/theme-registry'
import { PaperCardDecorations } from '@/components/board/decorations/PaperCardDecorations'
import { getShutdownAnimationClass } from '@/lib/animation/tag-shutdown'
import { getEntryAnimation } from '@/lib/animation/tag-entry'
import { extractTypedCandidatesFromBookmark } from '@/lib/board/tag-candidates'
import { HeuristicTagger } from '@/lib/tagger/heuristic'
import type { SuggestionEntry } from './TagAddPopover'
import type { TagRecord, BookmarkRecord } from '@/lib/storage/indexeddb'
import { TagAddPopover } from './TagAddPopover'
import { TagIndicatorStrip } from './TagIndicatorStrip'
import { CardNode } from './CardNode'
import { MediaTypeIndicator, type MediaType } from './MediaTypeIndicator'
import { InlineMediaPlayer, canPlayInline, canViewportAutoplay } from './embeds'
import { CardSlideshow } from './CardSlideshow'
import { resolveSlideshowFrames } from '@/lib/board/slideshow-frames'
import { resolveTweetVideoExtraction } from '@/lib/board/tweet-video-extraction'
import { useReducedMotion } from '@/lib/board/use-reduced-motion'
import { PlaybackControlBar } from './PlaybackControlBar'
import { useViewportPlaybackPool } from '@/lib/board/use-viewport-playback-pool'
import { useSpotlightRotation } from '@/lib/board/use-spotlight-rotation'
import { ResizeHandle } from './ResizeHandle'
import { CardCornerActions } from './CardCornerActions'
import { useCardReorderDrag, computeVirtualOrder, makeSkylineSimulator, CLICK_THRESHOLD_PX } from './use-card-reorder-drag'
import { pickCard, itemSkylineHeight, ImageCard, paperCardHasTornBacking } from './cards'
import { selectPaperSoftShuffle } from '@/lib/board/paper-soft-shuffle'
import styles from './CardsLayer.module.css'

/** Max press-and-hold duration (ms) for a pointer gesture to still count as a
 *  tap in receiver mode. Mirrors the value useCardReorderDrag uses internally
 *  (CLICK_MAX_MS = 200 there — not exported, so replicated here). A slower
 *  press-and-hold is NOT treated as a tap. Paired with CLICK_THRESHOLD_PX
 *  (imported) for the 5px + 200ms tap window. */
const CLICK_MAX_MS = 200

/** Minimum width for the playback control bar = the DENSE preset card width
 *  (207.80px). The bar tracks the active card's width but never shrinks below
 *  this, so its knob + button stay comfortably operable on tiny cards. */
const MIN_CONTROL_BAR_WIDTH_PX = PRESETS.find((p) => p.id === 'dense')?.w ?? 207.8

/** Grace period after the cursor leaves the + TAG button / its popover before
 *  the popover auto-closes. Matches the filter / TUNE drawer (LEAVE_GRACE_MS)
 *  so all hover-dismiss chrome feels the same. */
const POPOVER_LEAVE_GRACE_MS = 700

/** Visibility-pool cap: high so the pool surfaces EVERY in-view video as a
 *  candidate. The rotating spotlight (below) is what actually bounds how many
 *  play at once. */
const TIER1_CAP = 999

/** A card must be at least this visible (fraction of its area on screen) to be a
 *  playback candidate. Without this, a card showing a 10% sliver at the screen
 *  edge could claim a slot while the user sees nothing moving on screen. */
const MIN_VISIBLE_RATIO = 0.3

/** Rotating spotlight. The 4K stutter is GPU-compositing-bound — fill-rate, not
 *  decode — and fill cost scales with the on-screen PIXEL AREA of the live
 *  videos, not their count. A big AMBIENT card (≈608px wide) covers ~8.5× the
 *  area of a DENSE card (≈208px), so "3 videos" means wildly different load per
 *  size. We therefore budget by area: how many live videos fit in a fixed total
 *  area (≈ three DENSE cards). Small cards → ~3 play; huge AMBIENT cards → ~1.
 *  The live set IS what's mounted (no crossfade overlap), so the simultaneously-
 *  PLAYING count never exceeds the cap. Tune the budget on real hardware. */
/** Exactly ONE video plays for real at a time (the "hero"). Everything else
 *  in view runs the cheap still-frame slideshow (CardSlideshow), so the heavy
 *  GPU compositing cost is a single playing region instead of several. */
const HERO_CAP = 1
/** How long the hero dwells on one card before the spotlight hands off to the
 *  next in-view video card. Generous: a YouTube iframe spends ~2-3s starting
 *  up (hidden behind the thumbnail until it truly plays). */
const HERO_PER_CARD_MS = 15000
const MIN_ROTATE_MS = 1500

/** Derive the media-type badge for a bookmark from existing fields — no
 *  new persisted data needed. Returns null for cards where a video/photo
 *  badge wouldn't add information (text-only items: the card itself
 *  already reads as text). */
// resolveTweetVideoExtraction (incl. the mixed-media skip gate) now lives in
// @/lib/board/tweet-video-extraction so it can be unit-tested in isolation.

/** Adapt a BoardItem into the BookmarkRecord shape that
 *  extractTypedCandidatesFromBookmark and HeuristicTagger expect. BoardItem
 *  omits siteName / type; we derive both from the URL so the popover can
 *  still surface a "+ YouTube" / "+ Vimeo" candidate even when OGP didn't
 *  fill siteName. */
function buildBookmarkShape(item: BoardItem): BookmarkRecord {
  let siteName = ''
  try {
    const host = new URL(item.url).hostname.replace(/^www\./, '')
    const friendly: Record<string, string> = {
      'youtube.com': 'YouTube',
      'youtu.be': 'YouTube',
      'x.com': 'X',
      'twitter.com': 'X',
      'vimeo.com': 'Vimeo',
      'tiktok.com': 'TikTok',
      'soundcloud.com': 'SoundCloud',
      'instagram.com': 'Instagram',
      'note.com': 'note',
      'github.com': 'GitHub',
    }
    siteName = friendly[host] ?? host
  } catch {
    /* invalid URL — fall through with empty siteName */
  }
  return {
    id: item.bookmarkId,
    url: item.url,
    title: item.title,
    description: item.description ?? '',
    thumbnail: item.thumbnail ?? '',
    favicon: '',
    siteName,
    type: detectUrlType(item.url),
    savedAt: '',
    ogpStatus: 'fetched',
    tags: [...item.tags],
  }
}

/** Confidence levels for new-tag candidates (= those that don't yet exist
 *  in the user's tag master). Hashtags are explicit user signal so they
 *  rank near hashtag exact match in HeuristicTagger (0.95); siteName is
 *  moderately relevant, between domain match (0.8) and keyword (0.5). */
const NEW_CANDIDATE_CONFIDENCE: Record<'siteName' | 'hashtag', number> = {
  hashtag: 0.9,
  siteName: 0.65,
}

const SUGGESTED_MAX = 5

/** Stable empty result so the suggestions memo returns the same reference when
 *  no popover is open (avoids handing TagAddPopover a fresh [] each render). */
const EMPTY_SUGGESTIONS: readonly SuggestionEntry[] = []

/** Merge HeuristicTagger existing-tag suggestions with raw new-name
 *  candidates, drop duplicates (case-insensitive name match against the
 *  tag master), sort by confidence, and cap. Called only when the popover
 *  is open for a card. */
function computeSuggestedEntries(
  item: BoardItem,
  allTags: readonly TagRecord[],
): readonly SuggestionEntry[] {
  const shape = buildBookmarkShape(item)
  const tagger = new HeuristicTagger({ tags: allTags })
  const heuristic = tagger.suggestSync({
    url: shape.url,
    title: shape.title,
    description: shape.description,
    siteName: shape.siteName,
  })
  const typed = extractTypedCandidatesFromBookmark(shape)
  const existingNames = new Set(allTags.map((t) => t.name.toLowerCase()))
  const newCandidates = typed.filter((c) => !existingNames.has(c.name.toLowerCase()))

  type Ranked = { readonly entry: SuggestionEntry; readonly confidence: number }
  const ranked: Ranked[] = [
    ...heuristic.map((s) => ({
      entry: { kind: 'existing' as const, tagId: s.tagId },
      confidence: s.confidence,
    })),
    ...newCandidates.map((c) => ({
      entry: { kind: 'new' as const, name: c.name },
      confidence: NEW_CANDIDATE_CONFIDENCE[c.source],
    })),
  ]
  ranked.sort((a, b) => b.confidence - a.confidence)
  return ranked.slice(0, SUGGESTED_MAX).map((r) => r.entry)
}

function deriveMediaType(item: BoardItem): MediaType | null {
  const urlType = detectUrlType(item.url)
  // SoundCloud is audio — show the music note, not a photo/video icon.
  if (urlType === 'soundcloud') return 'audio'
  const isVideo =
    urlType === 'youtube' ||
    urlType === 'vimeo' ||
    urlType === 'tiktok' ||
    (urlType === 'instagram' && isInstagramReel(item.url)) ||
    (urlType === 'tweet' && item.hasVideo === true)
  if (isVideo) return 'video'
  if (item.thumbnail) return 'photo'
  return null
}

type Viewport = {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

type CardsLayerProps = {
  readonly items: ReadonlyArray<BoardItem>
  readonly viewport: Viewport
  readonly viewportWidth: number
  /** Board-wide card gap in pixels — driven by the GapSlider in the
   *  toolbar. Threaded through the same skyline layout calls that use
   *  defaultCardWidth so changing the slider reflows cards live. */
  readonly cardGapPx: number
  readonly hoveredBookmarkId: string | null
  /** Phase 1 multi-playback (Tier 3): id of the single card currently
   *  playing with audio, or null. The matching card mounts an inline
   *  player over its thumbnail and shows its media indicator as active. */
  readonly audioActiveId: string | null
  /** Toggle inline audio playback for a card (fired by its media
   *  indicator). Switching to a new card moves the audio over to it. */
  readonly onToggleAudio: (bookmarkId: string) => void
  /** Per-card ephemeral playback controls for the active card (PlaybackControlBar). */
  readonly audioVolume: number
  readonly audioPaused: boolean
  readonly onAudioVolumeChange: (next: number) => void
  readonly onAudioTogglePause: () => void
  readonly spaceHeld: boolean
  readonly onHoverChange: (id: string | null) => void
  readonly onClick: (bookmarkId: string, originRect: DOMRect) => void
  readonly onDrop: (orderedBookmarkIds: readonly string[]) => void
  /** Soft-delete handler — fired by the visible × button in the card's
   *  top-right corner. Right-click is intentionally NOT wired up so
   *  the gesture stays free for future affordances (selection, etc). */
  readonly onDelete: (bookmarkId: string) => void
  /** True when the parent BoardRoot is rendering the TRASH view. Forwarded
   *  to CardCornerActions so its × icon flips to a ↺ restore icon — the
   *  onDelete handler in BoardRoot is already context-aware (= calls
   *  persistSoftDelete(id, false) when this is true). */
  readonly inTrash?: boolean
  readonly persistMeasuredAspect?: (cardId: string, aspectRatio: number) => Promise<void>
  readonly displayMode: DisplayMode
  readonly newlyAddedIds: ReadonlySet<string>
  /** Default per-card width for cards with no custom width — derived from
   *  the active size slider level so the board still distributes evenly
   *  across N columns. Skyline layout uses this for every card whose id
   *  is NOT in the resize override map. */
  readonly defaultCardWidth: number
  /** In-memory per-card resize overrides (lifted to BoardRoot so the
   *  scroll-range calculation there sees the same widths). */
  readonly customWidths: Readonly<Record<string, number>>
  /** Notify the parent of a per-card width update during a resize drag. */
  readonly onCardResize: (bookmarkId: string, nextWidth: number) => void
  /** Fired once the user releases the resize handle. The parent persists
   *  the final width to IDB and flips `customCardWidth` to true. */
  readonly onCardResizeEnd: (bookmarkId: string, finalWidth: number) => void
  /** Fired when the user clicks the per-card "reset size" affordance.
   *  The parent clears the IDB flag for this bookmark. */
  readonly onCardResetSize: (bookmarkId: string) => void
  /** When the lightbox is open, the card with this id is the one that
   *  opened it (the "source"). It is held visibility:hidden on the board
   *  for the duration of the lightbox session so the user sees a calm
   *  blank slot where their click originated — matching destefanis-style
   *  moodboards where the click "becomes" the lightbox. Reflow is
   *  intentionally suppressed (visibility, not display:none) so the rest
   *  of the layout does not jitter, and the slot stays available as the
   *  visual home for the close-FLIP return. (B-#11)  */
  readonly sourceCardId?: string | null
  /** Edge auto-scroll callback for drag-to-reorder. Forwarded straight
   *  through to useCardReorderDrag. Optional so the share-view caller
   *  (which currently has no scroll) can omit it. */
  readonly onPanY?: (requestedDy: number) => number
  /** Tier 1 master switch — when false, no viewport autoplay. */
  readonly motionEnabled: boolean
  /** Onboarding tag scene: force the hover-gated +TAG button visible &
   *  clickable (the user can't hover through the spotlight hole). */
  readonly forceTagButtonVisible?: boolean
  /** Tag-filter match set. null = no tag filter active (every card matches).
   *  When set, cards whose id is NOT in the set are "tagged out": they play
   *  the CRT shutdown animation and drop out of the masonry input so the
   *  matched cards reflow naturally via the existing GSAP-FLIP useLayoutEffect. */
  readonly matchedBookmarkIds?: ReadonlySet<string> | null
  /** All tags the user has created so far. Drives the popover's "existing tags"
   *  list. */
  readonly allTags?: readonly TagRecord[]
  /** Toggle an existing tag on a bookmark — add if absent, remove if present. */
  readonly onTagToggle?: (bookmarkId: string, tagId: string) => Promise<void> | void
  /** Create a brand-new tag and immediately attach it to the bookmark.
   *  Implementation in BoardRoot dedupes by case-insensitive name. */
  readonly onTagCreate?: (bookmarkId: string, name: string) => Promise<void> | void
  /** Toggle a tag in the board-wide filter (= clicking a per-card tag pill
   *  reuses the chrome TagFilterBar's add/remove semantics). sourceBookmarkId
   *  identifies which card the click originated from, used by BoardRoot to
   *  restore the scroll position on filter clear (= source-aware navigation). */
  readonly onTagFilterToggle?: (tagId: string, sourceBookmarkId?: string) => void
  /** Right-click on a per-card tag pill. Forwarded to TagIndicatorStrip
   *  so the parent can open a context menu near the pointer. */
  readonly onTagContextMenu?: (e: { clientX: number; clientY: number }, tagId: string) => void
  /** Id of the tag currently targeted by a right-click menu — pills
   *  matching this id render with a red text-glow. */
  readonly activeContextTagId?: string | null
  /** True during an active scroll session — CardSlideshow defers new tweet-
   *  video frame extractions when set, to keep the canvas smooth. */
  readonly isScrolling?: boolean
  /** Monotonically incrementing key bumped on every BoardFilter change.
   *  Used to trigger the carded entry animation (= fade-up) on all
   *  currently-matched cards once per filter change. 0 = initial mount
   *  (no animation). */
  readonly entryAnimCycle?: number
  /** Receiver (shared-view) mode. When set, the per-card editing chrome is
   *  suppressed; instead each card shows read-only sender tags (top-left) and
   *  a corner × that removes the card from the working set. No selection, no
   *  tag toggles — import takes the whole visible set (tags not imported). */
  readonly receiverMode?: {
    /** Cards removed from the working set (× pressed). */
    readonly removedUrls: ReadonlySet<string>
    /** Sender's tag dictionary (id → { n, c? }) for read-only display. */
    readonly senderTags: Readonly<Record<string, { n: string; c?: string }>>
    /** Sender tag ids per card url. */
    readonly senderTagIdsByCard: ReadonlyMap<string, ReadonlyArray<string>>
    /** × handler: remove this card url from the working set. */
    readonly onRemove: (url: string) => void
  }
  /** Active board theme id. Drives per-card decorations (meta.decorations)
   *  and, from Task 5, the entry/shutdown motion keys. */
  readonly themeId: ThemeId
}

export function CardsLayer({
  items,
  viewport,
  viewportWidth,
  cardGapPx,
  hoveredBookmarkId,
  audioActiveId,
  onToggleAudio,
  audioVolume,
  audioPaused,
  onAudioVolumeChange,
  onAudioTogglePause,
  spaceHeld,
  onHoverChange,
  onClick,
  onDrop,
  onDelete,
  inTrash = false,
  persistMeasuredAspect,
  displayMode,
  newlyAddedIds,
  defaultCardWidth,
  customWidths,
  onCardResize,
  onCardResizeEnd,
  onCardResetSize,
  sourceCardId,
  onPanY,
  motionEnabled,
  matchedBookmarkIds,
  allTags,
  onTagToggle,
  onTagCreate,
  onTagFilterToggle,
  onTagContextMenu,
  activeContextTagId,
  isScrolling = false,
  entryAnimCycle = 0,
  receiverMode,
  forceTagButtonVisible = false,
  themeId,
}: CardsLayerProps): ReactNode {
  const rootRef = useRef<HTMLDivElement>(null)
  const meta = getThemeMeta(themeId)

  // Filter 変化 → 復活してくる (= matched) カードに WAVE テーマの fade-up
  // entry アニメを stagger 付きで適用。 inner wrapper (= shutdown が走る
  // div、 GSAP-FLIP の outer transform とは別レイヤー) に WAAPI で当てる
  // ので位置 matrix を壊さない。 初回 mount (cycle 0) は skip。
  useEffect(() => {
    if (entryAnimCycle === 0) return
    const root = rootRef.current
    if (!root) return
    const entryAnim = getEntryAnimation(meta.motion.entry)
    if (!entryAnim) return
    const prefersReducedMotion = typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const targets = root.querySelectorAll<HTMLElement>('[data-tagged-out="false"]')
    targets.forEach((el, idx) => {
      const rawDelay = idx * entryAnim.staggerStepMs
      const delay = Math.min(rawDelay, entryAnim.staggerCapMs)
      if (prefersReducedMotion) {
        // 視覚過敏 user 配慮: CRT bloom + glitch + scale 全部 skip、
        // 単純 opacity fade のみ。 stagger は keep (= 復活の認知補助)。
        el.animate(
          [{ opacity: '0' }, { opacity: '1' }],
          { duration: 180, easing: 'ease-out', fill: 'none', delay },
        )
      } else {
        el.animate(entryAnim.keyframes, { ...entryAnim.options, delay })
      }
    })
  }, [entryAnimCycle])
  // Which card currently has its add-tag popover open. Null = none.
  // Toggled by the + TAG corner button. Closed by Esc / click-outside (both
  // inside TagAddPopover), by clicking + TAG again, or by the cursor leaving
  // the button + popover hover zone for POPOVER_LEAVE_GRACE_MS.
  const [popoverOpenFor, setPopoverOpenFor] = useState<string | null>(null)
  // True while the open popover is playing its exit animation. The popover
  // stays mounted (so the animation can run) until it reports onExited, which
  // clears popoverOpenFor. Single flag is fine: only one popover is open.
  const [popoverClosing, setPopoverClosing] = useState(false)

  // Tag suggestions for the open popover only. computeSuggestedEntries builds a
  // HeuristicTagger + extracts typed candidates, so calling it inline in render
  // recomputed it on every unrelated re-render (hover, scroll, audio) while a
  // popover was open. Memoize so it recomputes only when the open card, the
  // board items, or the tag master actually change (rank40). Uses the full
  // `items` prop (not the scroll-dependent visible set) so scrolling doesn't
  // invalidate it.
  const openPopoverSuggestions = useMemo<readonly SuggestionEntry[]>(() => {
    // allTags === undefined ⇒ the whole tag affordance is gated off in render
    // (same guard as the popover block), so suggestions are never shown.
    if (!popoverOpenFor || allTags === undefined) return EMPTY_SUGGESTIONS
    const openItem = items.find((it) => it.bookmarkId === popoverOpenFor)
    return openItem ? computeSuggestedEntries(openItem, allTags) : EMPTY_SUGGESTIONS
  }, [popoverOpenFor, items, allTags])
  const popoverLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearPopoverTimer = useCallback((): void => {
    if (popoverLeaveTimer.current) {
      clearTimeout(popoverLeaveTimer.current)
      popoverLeaveTimer.current = null
    }
  }, [])
  // Cursor entered the button or popover — cancel any pending close and undo
  // an in-flight exit so moving between the trigger and the popover (or back
  // onto a closing popover) keeps it open.
  const cancelPopoverClose = useCallback((): void => {
    clearPopoverTimer()
    setPopoverClosing((c) => (c ? false : c))
  }, [clearPopoverTimer])
  // Cursor left the hover zone — close after the grace period.
  const schedulePopoverClose = useCallback((): void => {
    clearPopoverTimer()
    popoverLeaveTimer.current = setTimeout((): void => {
      popoverLeaveTimer.current = null
      setPopoverClosing(true)
    }, POPOVER_LEAVE_GRACE_MS)
  }, [clearPopoverTimer])
  // Start the exit animation now (Esc / click-outside / + TAG re-click / add).
  const beginPopoverClose = useCallback((): void => {
    clearPopoverTimer()
    setPopoverClosing(true)
  }, [clearPopoverTimer])
  // Exit animation finished — actually unmount.
  const finishPopoverClose = useCallback((): void => {
    setPopoverOpenFor(null)
    setPopoverClosing(false)
  }, [])
  const openPopoverFor = useCallback((id: string): void => {
    clearPopoverTimer()
    setPopoverClosing(false)
    setPopoverOpenFor(id)
  }, [clearPopoverTimer])
  useEffect(() => clearPopoverTimer, [clearPopoverTimer])
  // Per-render lookup so the per-card TagIndicatorStrip can resolve
  // bookmark.tags[] (ids) into the TagRecord shape it needs in O(1).
  const tagsById = useMemo<ReadonlyMap<string, TagRecord>>(
    () => new Map((allTags ?? []).map((t) => [t.id, t])),
    [allTags],
  )
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  // Throttle: skip recomputing virtual order if card hasn't moved >8px since last compute.
  const lastComputeRef = useRef<{ x: number; y: number } | null>(null)
  // Last chosen insertion index — windows computeVirtualOrder's search near it
  // so a large board stays smooth to drag. Reset (null) at each drag's start.
  const lastBestIndexRef = useRef<number | null>(null)
  const reduceMotion = useReducedMotion()

  // ── Tier 1 viewport autoplay ──
  // Intersection-observed visibility drives a debounced pool of up to TIER1_CAP
  // muted autoplay players. When motionEnabled is false the cap is 0, so the
  // pool stays empty and no observers are attached.
  const pool = useViewportPlaybackPool(motionEnabled ? TIER1_CAP : 0, 150, MIN_VISIBLE_RATIO)
  const vizObservers = useRef<Map<string, IntersectionObserver>>(new Map())
  const vizElements = useRef<Map<string, HTMLElement>>(new Map())
  const observeViz = useCallback((id: string) => {
    return (el: HTMLElement | null): void => {
      if (el !== null && vizElements.current.get(id) === el) return // same element — no churn
      const existing = vizObservers.current.get(id)
      if (existing) { existing.disconnect(); vizObservers.current.delete(id) }
      vizElements.current.delete(id)
      if (!el || !motionEnabled) { pool.report(id, 0); return }
      vizElements.current.set(id, el)
      const obs = new IntersectionObserver(
        (entries) => { for (const e of entries) pool.report(id, e.isIntersecting ? e.intersectionRatio : 0) },
        // Fine-grained around the MIN_VISIBLE_RATIO cutoff (0.3) so a card is
        // promoted/dropped responsively as it scrolls past ~30% visible.
        { threshold: [0, 0.15, 0.3, 0.45, 0.6, 0.8, 1] },
      )
      obs.observe(el)
      vizObservers.current.set(id, obs)
    }
  }, [motionEnabled, pool])
  useEffect(() => () => {
    vizObservers.current.forEach((o) => o.disconnect())
    vizObservers.current.clear()
    vizElements.current.clear()
  }, [])

  // ── Tier 1 unplayable tracking ──
  // When an embed detects it cannot play (embed-restricted YouTube, broken mp4,
  // etc.) it calls markUnplayable(id). The id is added to this set and excluded
  // from the Tier 1 muted overlay render so the card's thumbnail shows through.
  // The set persists for the session; motionEnabled OFF/ON does NOT clear it
  // (keeping it simple — avoiding re-trying videos we already know are broken).
  const [unplayableIds, setUnplayableIds] = useState<ReadonlySet<string>>(new Set())
  const markUnplayable = useCallback((id: string): void => {
    setUnplayableIds((prev) => prev.has(id) ? prev : new Set(prev).add(id))
  }, [])


  // Stage 2: virtual order during drag for live reflow preview.
  // null = no drag in progress (use real masonry order).
  const [virtualOrderedIds, setVirtualOrderedIds] = useState<readonly string[] | null>(null)

  // Per-card intrinsic heights reported by text-heavy cards (Tweet/Text).
  // When set, masonry uses this as absolute height instead of width / aspectRatio.
  // Keyed by bookmarkId. Image / video cards do not report — masonry falls back to aspectRatio.
  const [intrinsicHeights, setIntrinsicHeights] = useState<Readonly<Record<string, number>>>({})
  const reportIntrinsicHeight = useCallback((bookmarkId: string, h: number): void => {
    setIntrinsicHeights((prev) => {
      const existing = prev[bookmarkId]
      if (existing != null && Math.abs(existing - h) < 4) return prev
      return { ...prev, [bookmarkId]: h }
    })
  }, [])

  // ── Control-bar exit animation ──
  // The bar must keep the SAME DOM node from active → closing → unmount, or its
  // tuck-out transition can't fire (a freshly-mounted node starts already
  // hidden, so there's nothing to animate from). So which card "owns" a bar is
  // a separate piece of state, `barMount`, that lags behind audioActiveId:
  //   - activate / switch → mount fresh for the new card (closing:false)
  //   - deactivate (■ stop)→ keep the SAME card mounted, flip closing:true so
  //     `visible` drops and the bar tucks back up into the card, then unmount
  //     after the transition window.
  // The InlineMediaPlayer overlay still keys off audioActiveId directly, so
  // playback stops the instant ■ is pressed; only the bar lingers to animate.
  const [barMount, setBarMount] = useState<{ id: string; closing: boolean } | null>(null)
  const prevAudioActiveRef = useRef<string | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const prev = prevAudioActiveRef.current
    prevAudioActiveRef.current = audioActiveId
    if (audioActiveId) {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
      setBarMount({ id: audioActiveId, closing: false })
    } else if (prev) {
      setBarMount({ id: prev, closing: true })
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
      closeTimerRef.current = setTimeout(() => {
        setBarMount(null)
        closeTimerRef.current = null
      }, 260) // ≥ the bar's hidden-state transform transition (200ms) + buffer
    }
  }, [audioActiveId])
  useEffect(
    () => (): void => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    },
    [],
  )

  // Session-2 per-card resize overrides — lifted to BoardRoot so the
  // scroll-range calculation there sees the same widths as the cards
  // layer's render layout.
  const resolveCardWidth = useCallback(
    (bookmarkId: string): number => customWidths[bookmarkId] ?? defaultCardWidth,
    [customWidths, defaultCardWidth],
  )

  // Resolve each card's render width + height for the skyline engine.
  // Width comes from `customWidths` if the card has been resized in
  // this session, otherwise from `defaultCardWidth` (= the size slider
  // level's auto-distribute width). Height is intrinsic for text cards
  // or `width / aspectRatio` for image/video cards.
  const buildSkylineCard = useCallback(
    (it: BoardItem): SkylineCard => {
      const w = resolveCardWidth(it.bookmarkId)
      // Prefer a card's reported intrinsic height when present (covers the
      // ImageCard→PlaceholderCard error fallback, where a thumbnail card flips
      // to a placeholder at runtime). Otherwise use the deterministic height —
      // crucially this is w/PLACEHOLDER_ASPECT for placeholder cards, so the
      // masonry no longer waits for each card to mount and report (which made
      // cards below it reshuffle while scrolling). See itemSkylineHeight.
      const intrinsic = intrinsicHeights[it.bookmarkId]
      const h = intrinsic && intrinsic > 0 ? intrinsic : itemSkylineHeight(it, w)
      return { id: it.bookmarkId, width: w, height: h }
    },
    [resolveCardWidth, intrinsicHeights],
  )


  // When a tag filter is active, masonry only considers matched cards so the
  // remaining cards collapse into a compact grid. Tagged-out cards are still
  // rendered (so the CRT shutdown animation can play); their position falls
  // back to the cached prev position (see displayedPositions below).
  const itemsForMasonry = useMemo(() => {
    if (!matchedBookmarkIds) return items
    return items.filter((it) => matchedBookmarkIds.has(it.bookmarkId))
  }, [items, matchedBookmarkIds])

  const skylineCards = useMemo<SkylineCard[]>(
    () => itemsForMasonry.map(buildSkylineCard),
    [itemsForMasonry, buildSkylineCard],
  )

  const masonryLayout = useMemo(
    () =>
      computeSkylineLayout({
        cards: skylineCards,
        containerWidth: viewportWidth,
        gap: cardGapPx,
      }),
    [skylineCards, viewportWidth, cardGapPx],
  )

  // Stage 2: preview layout computed from the live virtual order.
  const previewMasonry = useMemo(() => {
    if (!virtualOrderedIds) return null
    const idToItem = new Map(items.map((it) => [it.bookmarkId, it]))
    const orderedCards: SkylineCard[] = []
    for (const id of virtualOrderedIds) {
      const it = idToItem.get(id)
      if (!it) continue
      orderedCards.push(buildSkylineCard(it))
    }
    return computeSkylineLayout({
      cards: orderedCards,
      containerWidth: viewportWidth,
      gap: cardGapPx,
    })
  }, [virtualOrderedIds, items, viewportWidth, cardGapPx, buildSkylineCard])

  // Per-card "is the paper backing a torn sheet?" — computed once per items
  // change (NOT per render). During a drag the board re-renders on every
  // pointer step; recomputing pickCard/detectUrlType for every card each frame
  // was needless work. Lookup is O(1) in the render below. Paper-only.
  const tornBackingById = useMemo(() => {
    const m = new Map<string, boolean>()
    if (meta.decorations === true) {
      for (const it of items) m.set(it.bookmarkId, paperCardHasTornBacking(it))
    }
    return m
  }, [items, meta.decorations])

  // Previous-position ledger used to animate masonry reflows via FLIP.
  // Updated at the end of every effect run. Declared above displayedPositions
  // so the useMemo below can read prevPositionsRef.current without hitting
  // the TDZ when matchedBookmarkIds is active.
  // w/h も保存することで、 scroll 中 (= 位置もサイズも不変) の主経路で
  // useLayoutEffect が gsap.set を呼ばずに済む = 毎秒数千回の無駄な
  // GPU command を撲滅して scroll jank を解消する (session 76)。
  const prevPositionsRef = useRef<Record<string, { x: number; y: number; w: number; h: number }>>({})

  // During drag, use preview positions for non-dragged cards.
  // During drop/idle, use real masonry positions.
  // Tagged-out cards (= filter active, card not in match set) have no
  // entry in masonryLayout.positions because itemsForMasonry excludes
  // them. They still need a position so they can render the shutdown
  // animation — we fall back to the cached prev position from the last
  // render. prevPositionsRef is populated by the GSAP-FLIP useLayoutEffect
  // and reflects the position the card had BEFORE the filter activated.
  const displayedPositions = useMemo<Readonly<Record<string, CardPosition>>>(() => {
    const fromMasonry = previewMasonry?.positions ?? masonryLayout.positions
    if (!matchedBookmarkIds) return fromMasonry
    const out: Record<string, CardPosition> = { ...fromMasonry }
    for (const it of items) {
      if (matchedBookmarkIds.has(it.bookmarkId)) continue
      if (out[it.bookmarkId]) continue
      const prev = prevPositionsRef.current[it.bookmarkId]
      if (!prev) continue
      const card = buildSkylineCard(it)
      out[it.bookmarkId] = { x: prev.x, y: prev.y, w: card.width, h: card.height }
    }
    return out
  }, [previewMasonry, masonryLayout.positions, matchedBookmarkIds, items, buildSkylineCard])

  const visibleItems = useMemo(() => {
    const bufferX = viewport.w * CULLING.BUFFER_SCREENS
    const bufferY = viewport.h * CULLING.BUFFER_SCREENS
    const minX = viewport.x - bufferX
    const maxX = viewport.x + viewport.w + bufferX
    const minY = viewport.y - bufferY
    const maxY = viewport.y + viewport.h + bufferY

    return items.filter((it) => {
      const p = displayedPositions[it.bookmarkId]
      if (!p) return false
      return !(p.x + p.w < minX || p.x > maxX || p.y + p.h < minY || p.y > maxY)
    })
  }, [items, displayedPositions, viewport])

  // ── Rotating spotlight ──
  // Candidates = every in-view card that may autoplay and isn't known-broken,
  // in the pool's most-visible-first order. The spotlight plays only SPOTLIGHT_N
  // of them at once and rotates the live set so the whole board cycles through;
  // The live set IS what's mounted — no lingering crossfade, so the number of
  // simultaneously PLAYING videos never exceeds SPOTLIGHT_N (a brief overlap
  // would spike to N+1 and bring back the 4K stutter at each handoff). Entering
  // cards fade in over their own thumbnail (ambientSpotIn); a retiring card
  // unmounts at once, revealing the still thumbnail beneath. `playing` drives
  // the overlay render below.
  const itemById = useMemo(() => {
    const m = new Map<string, (typeof visibleItems)[number]>()
    for (const it of visibleItems) m.set(it.bookmarkId, it)
    return m
  }, [visibleItems])
  const candidates = useMemo(() => {
    const out = new Set<string>()
    for (const id of pool.active) {
      const it = itemById.get(id)
      if (it && canViewportAutoplay(it) && !unplayableIds.has(id)) out.add(id)
    }
    return out
  }, [pool.active, itemById, unplayableIds])
  // Stop all ambient motion (hero video AND slideshow) while the Lightbox is
  // open (sourceCardId set), when the OS prefers reduced motion, or during an
  // active scroll session: the board freezes to still thumbnails so nothing
  // competes with the focused view and we don't burn GPU on hidden cards.
  // scroll 中停止は session 76 で追加: メータークリックや wheel scroll の
  // 走行中、 hero iframe の mount/unmount + CardSlideshow の crossfade mount
  // が paint を集中させて jank。 isScrolling は markScrollActive で 200ms
  // idle 後 false に戻るので、 scroll 終了から 200ms で ambient 自然復帰。
  const ambientOn = motionEnabled && !sourceCardId && !reduceMotion && !isScrolling
  // Paper soft-shuffle vs default hard-cut. meta.decorations === true marks the
  // paper-atelier theme (only theme with decorations); ambientOn already folds
  // motionEnabled + !reduceMotion + !isScrolling + !sourceCardId.
  const softShuffleSel = selectPaperSoftShuffle({ softShuffle: meta.decorations === true, ambientOn })
  const rotateMs = Math.max(MIN_ROTATE_MS, HERO_PER_CARD_MS)
  const spotlightCap = ambientOn ? HERO_CAP : 0
  const playing = useSpotlightRotation(candidates, spotlightCap, rotateMs)

  // dragState ref for use inside useLayoutEffect without triggering extra renders
  const dragStateRef = useRef<{ bookmarkId: string } | null>(null)

  useLayoutEffect(() => {
    const draggedId = dragStateRef.current?.bookmarkId ?? null

    for (const it of visibleItems) {
      // Skip the card being dragged — the drag hook owns its transform.
      if (it.bookmarkId === draggedId) continue

      const el = cardRefs.current[it.bookmarkId]
      if (!el) continue
      const p = displayedPositions[it.bookmarkId]
      if (!p) continue

      const prev = prevPositionsRef.current[it.bookmarkId]
      const positionMoved = prev && (prev.x !== p.x || prev.y !== p.y)
      const sizeChanged = prev && (prev.w !== p.w || prev.h !== p.h)
      if (positionMoved) {
        // FLIP: animate from element's current live transform to new position.
        // gsap.to (not fromTo) continues from wherever the element is now —
        // avoids the per-tick snap-back to stored prev on fast pointer movement.
        const isLiveReflow = draggedId !== null
        gsap.to(el, {
          x: p.x,
          y: p.y,
          width: p.w,
          height: p.h,
          duration: isLiveReflow ? 0.18 : 0.15,
          ease: 'power2.out',
          overwrite: 'auto',
        })
      } else if (sizeChanged) {
        // 位置不変 + サイズだけ変化 (= リサイズ、 hero 切替で intrinsic 変化、 等)。
        // 位置 transform は触らず width/height のみ反映する。
        gsap.set(el, { width: p.w, height: p.h, overwrite: 'auto' })
      } else if (!prev) {
        // 初期 mount (= prev 不在)。 位置 + サイズ両方を一発で set。
        gsap.set(el, { x: p.x, y: p.y, width: p.w, height: p.h, overwrite: 'auto' })
      }
      // else: 位置もサイズも不変 → no-op。 scroll 中の 99% はここに落ちる。
      // 数百個 × 60fps の gsap.set を毎秒撲滅する主経路。
      prevPositionsRef.current[it.bookmarkId] = { x: p.x, y: p.y, w: p.w, h: p.h }
    }
    // Garbage-collect stale entries (cards unmounted due to culling)
    const liveIds = new Set(visibleItems.map((it) => it.bookmarkId))
    for (const id of Object.keys(prevPositionsRef.current)) {
      if (!liveIds.has(id)) delete prevPositionsRef.current[id]
    }
  }, [visibleItems, displayedPositions])

  const {
    dragState,
    handleCardPointerDown: handleReorderPointerDown,
  } = useCardReorderDrag({
    items,
    positions: masonryLayout.positions,
    spaceHeld,
    onClick,
    onModifierClick: useCallback(
      (id: string): void => {
        // Ctrl/⌘ + click → open the bookmark's original URL in a new tab.
        // Guard the scheme so a stored javascript:/data: URL can't execute.
        const it = items.find((b) => b.bookmarkId === id)
        const safe = safeExternalUrl(it?.url)
        if (safe) window.open(safe, '_blank', 'noopener,noreferrer')
      },
      [items],
    ),
    onDragMove: useCallback(
      (
        id: string,
        cardWorldX: number,
        cardWorldY: number,
        _pointerWorldX: number,
        _pointerWorldY: number,
      ): void => {
        // Stage 1: instant pointer follow — gsap.set is synchronous, zero lag.
        const el = cardRefs.current[id]
        if (el) {
          gsap.set(el, { x: cardWorldX, y: cardWorldY, scale: 1.03, overwrite: 'auto' })
        }

        // Stage 2: position-preserving insertion — throttle via 8px movement delta.
        const last = lastComputeRef.current
        if (last && Math.abs(last.x - cardWorldX) < 8 && Math.abs(last.y - cardWorldY) < 8) {
          return // skip — no significant pointer movement
        }
        lastComputeRef.current = { x: cardWorldX, y: cardWorldY }

        const newOrder = computeVirtualOrder({
          items,
          draggedId: id,
          cardWorldX,
          cardWorldY,
          simulateLayout: makeSkylineSimulator({
            containerWidth: viewportWidth,
            gap: cardGapPx,
            resolveWidth: resolveCardWidth,
            intrinsicHeights,
          }),
          searchCenter: lastBestIndexRef.current ?? undefined,
        })
        // Remember where the dragged card landed so the next recompute windows
        // its search around it (keeps drag smooth on large boards).
        lastBestIndexRef.current = newOrder.indexOf(id)

        // Only update state if order actually changed — avoids re-render storms.
        setVirtualOrderedIds((prev) => {
          if (!prev) return newOrder
          if (prev.length !== newOrder.length) return newOrder
          for (let i = 0; i < prev.length; i++) {
            if (prev[i] !== newOrder[i]) return newOrder
          }
          return prev
        })
      },
      [items, viewportWidth, cardGapPx, resolveCardWidth, intrinsicHeights],
    ),
    onDrop: useCallback(
      (_orderedIds: readonly string[]): void => {
        // Reset throttle + search-window refs so the next drag starts fresh.
        lastComputeRef.current = null
        lastBestIndexRef.current = null

        const draggedId = dragStateRef.current?.bookmarkId

        // Resolve the final order: use latest virtualOrderedIds if set, else the
        // hook's _orderedIds (unused but kept as fallback).
        const finalOrder = virtualOrderedIds ?? _orderedIds

        // Compute the FINAL skyline layout manually — identical to what
        // masonryLayout will be after React commits the new items order. This
        // guarantees the positions we snap to match what React will render,
        // so FLIP's useLayoutEffect sees prev === p and issues no animation.
        const idToItem = new Map(items.map((it) => [it.bookmarkId, it]))
        const finalCards: SkylineCard[] = []
        for (const id of finalOrder) {
          const it = idToItem.get(id)
          if (!it) continue
          finalCards.push(buildSkylineCard(it))
        }
        const finalMasonry = computeSkylineLayout({
          cards: finalCards,
          containerWidth: viewportWidth,
          gap: cardGapPx,
        })

        // Snap all non-dragged cards to their FINAL masonry positions + scale 1,
        // killing any in-flight FLIP tweens. Using finalMasonry (not previewMasonry)
        // guarantees React's next render sees prev === p and issues no animation.
        for (const id of Object.keys(finalMasonry.positions)) {
          if (id === draggedId) continue
          const el = cardRefs.current[id]
          const p = finalMasonry.positions[id]
          if (el && p) {
            gsap.set(el, {
              x: p.x,
              y: p.y,
              width: p.w,
              height: p.h,
              scale: 1,
              overwrite: true,
            })
            prevPositionsRef.current[id] = { x: p.x, y: p.y, w: p.w, h: p.h }
          }
        }

        // Capture the dragged card's current DOM transform as its prev — FLIP in
        // the drop render animates from pointer position to new masonry slot.
        if (draggedId) {
          const el = cardRefs.current[draggedId]
          if (el) {
            const currentX = Number(gsap.getProperty(el, 'x'))
            const currentY = Number(gsap.getProperty(el, 'y'))
            // w/h は finalMasonry の確定位置から取得 (= 落下後の slot サイズ)。
            // fallback として既存 prev の値を使い、 無ければ 0 (= 初回 drop で
            // prev 未登録の極端ケース、 実質発生しないが defensive)。
            const draggedP = finalMasonry.positions[draggedId]
            const prevDragged = prevPositionsRef.current[draggedId]
            prevPositionsRef.current[draggedId] = {
              x: currentX,
              y: currentY,
              w: draggedP?.w ?? prevDragged?.w ?? 0,
              h: draggedP?.h ?? prevDragged?.h ?? 0,
            }
            // Instant scale snap — no 0.22s shrink tween
            gsap.set(el, { scale: 1, overwrite: 'auto' })
          }
        }

        // Commit the new order and clear virtual.
        onDrop(finalOrder)
        setVirtualOrderedIds(null)
      },
      [onDrop, virtualOrderedIds, items, viewportWidth, cardGapPx, buildSkylineCard],
    ),
    onPanY,
  })

  // Keep dragStateRef in sync so useLayoutEffect can read the dragged id
  // without a dependency that causes extra FLIP runs.
  dragStateRef.current = dragState ? { bookmarkId: dragState.bookmarkId } : null

  // Receiver-mode pointer handler. Cards in the shared-link recipient view
  // must NOT reorder/drag, but click-to-open (Lightbox FLIP) must still work.
  // So instead of the full reorder hook we bind a lightweight tap detector:
  // a gesture counts as a tap (and fires onClick) only when it both moves
  // less than CLICK_THRESHOLD_PX (5px) AND releases within CLICK_MAX_MS
  // (200ms) of pressing — the same window useCardReorderDrag applies. A
  // larger movement OR a slower press-and-hold is simply ignored (= no
  // drag, no reorder, no open). Bound only when receiverMode is set.
  //
  // We setPointerCapture on pointerdown (mirroring the reorder hook) so an
  // interrupted gesture — press, move off the card, release elsewhere —
  // still routes pointerup/pointercancel to this element and tears the
  // listeners down. Both terminal events run the same teardown so no
  // dangling listener can leak. Timestamps use the PointerEvent's own
  // e.timeStamp (Date.now() is forbidden in this codebase).
  const handleReceiverPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>, bookmarkId: string): void => {
      if (e.button > 0) return
      const el = e.currentTarget
      const pointerId = e.pointerId
      const startX = e.clientX
      const startY = e.clientY
      const startTime = e.timeStamp
      // Guard for environments (some test runners) without pointer capture.
      el.setPointerCapture?.(pointerId)
      const end = (ev: globalThis.PointerEvent): void => {
        el.removeEventListener('pointerup', end)
        el.removeEventListener('pointercancel', end)
        if (el.hasPointerCapture?.(pointerId)) el.releasePointerCapture(pointerId)
        // pointercancel must NOT open the lightbox — it only tears down. Only
        // a genuine pointerup that satisfies the tap window fires onClick.
        if (ev.type !== 'pointerup') return
        const distance = Math.hypot(ev.clientX - startX, ev.clientY - startY)
        const elapsed = ev.timeStamp - startTime
        if (elapsed < CLICK_MAX_MS && distance < CLICK_THRESHOLD_PX) {
          // For a paper image card seed the FLIP from the photo WINDOW rect (the
          // print), not the whole card — so the Lightbox lifts just the photo out
          // of the mat. Falls back to the card rect for every other card (N-12).
          const win = el.querySelector<HTMLElement>('[data-paper-window]')
          onClick(bookmarkId, (win ?? el).getBoundingClientRect())
        }
      }
      el.addEventListener('pointerup', end)
      el.addEventListener('pointercancel', end)
    },
    [onClick],
  )

  // Esc during drag → restore dragged card to its pre-drag slot (FLIP handles it).
  useEffect(() => {
    if (!dragState) return
    const onEsc = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      const el = cardRefs.current[dragState.bookmarkId]
      const p = masonryLayout.positions[dragState.bookmarkId]
      if (el && p) {
        gsap.to(el, {
          x: p.x, y: p.y, scale: 1, duration: 0.22, ease: 'power2.out', overwrite: 'auto',
        })
      }
      setVirtualOrderedIds(null)
    }
    window.addEventListener('keydown', onEsc)
    return (): void => {
      window.removeEventListener('keydown', onEsc)
    }
  }, [dragState, masonryLayout.positions])

  return (
    <div
      ref={rootRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: BOARD_Z_INDEX.CARDS,
        pointerEvents: 'none',
      }}
    >
      {visibleItems.map((it, cardIdx) => {
        const p = displayedPositions[it.bookmarkId]
        if (!p) return null
        const taggedOut = matchedBookmarkIds != null && !matchedBookmarkIds.has(it.bookmarkId)
        const shutdownClass = taggedOut ? getShutdownAnimationClass(meta.motion.shutdown) : undefined
        // When this card is the lightbox FLIP source, suppress all
        // hover-revealed meta affordances (+TAG, tag pills, ×, ↺) so the
        // morph clone captures the bare thumbnail. Without this they
        // visibly enlarge with the card during the lightbox open
        // transition — distracting per session 73 user feedback.
        const isLightboxSource = sourceCardId === it.bookmarkId
        const hoverActive = hoveredBookmarkId === it.bookmarkId && !isLightboxSource
        // Paper image cards mount their photo in a mat window (ImageCard's paper
        // branch). For those, the Lightbox lifts only the photo out and leaves
        // the mat on the board, so the source card must STAY visible (we hide
        // just the photo via `photoHidden`, below) instead of the whole-card
        // visibility:hidden used for every other card/theme (N-12).
        const isPaperWindowCard = meta.decorations === true && pickCard(it) === ImageCard
        return (
          <div
            key={it.bookmarkId}
            ref={(el): void => {
              cardRefs.current[it.bookmarkId] = el
              if (canViewportAutoplay(it)) observeViz(it.bookmarkId)(el)
            }}
            data-bookmark-id={it.bookmarkId}
            data-onboarding-target={cardIdx === 0 ? 'card' : undefined}
            data-link-status={it.linkStatus ?? undefined}
            onPointerDown={(e: PointerEvent<HTMLDivElement>): void =>
              receiverMode
                ? handleReceiverPointerDown(e, it.bookmarkId)
                : handleReorderPointerDown(e, it.bookmarkId)
            }
            onPointerEnter={(): void => onHoverChange(it.bookmarkId)}
            onPointerLeave={(): void => onHoverChange(null)}
            style={{
              position: 'absolute',
              // The whole card footprint reads as the click pointer (finger).
              // Without this the wrapper inherits the empty-board `grab` cursor
              // from InteractionLayer and leaks it into the slivers around the
              // hover controls (delete / +TAG / play) that aren't covered by a
              // pointer-events:auto element — flashing a hand just before the
              // pointer lands on a button. Cards = pointer; the corner
              // ResizeHandles set their own resize cursors; the bare board keeps
              // grab. CardNode's :active still shows `grabbing` while dragging.
              cursor: 'pointer',
              top: 0,
              left: 0,
              width: `${p.w}px`,
              height: `${p.h}px`,
              pointerEvents: sourceCardId === it.bookmarkId || taggedOut ? 'none' : 'auto',
              // Drag lifts highest (1000). A card with its add-tag popover open
              // floats at 900 so the popover (which extends past the card box)
              // is never occluded by a later-painted neighbour. The audio-active
              // card (and thus its attached control bar) floats at 500. Idle
              // cards stack by DOM order (undefined).
              zIndex:
                dragState?.bookmarkId === it.bookmarkId
                  ? 1000
                  : popoverOpenFor === it.bookmarkId
                    ? 900
                    : audioActiveId === it.bookmarkId || barMount?.id === it.bookmarkId
                      ? 500
                      : hoveredBookmarkId === it.bookmarkId
                        ? 100
                        : undefined,
              opacity: newlyAddedIds.has(it.bookmarkId) ? 0 : 1,
              // Hide the whole source card while the Lightbox is open — EXCEPT
              // paper image cards, which keep their mat on the board and only
              // hide the photo (photoHidden, below) so the print lifts out of
              // the frame (N-12).
              visibility: isLightboxSource && !isPaperWindowCard ? 'hidden' : undefined,
              animation: newlyAddedIds.has(it.bookmarkId) ? 'booklage-entrance-a 400ms ease-out forwards' : undefined,
              ['--card-radius' as string]: meta.colorScheme === 'light' ? '3px' : '20px',
            }}
          >
            {/* Tag-shutdown wrapper. The outer div above carries the GSAP
                positioning transform, so the shutdown CSS keyframes
                (which animate transform: scale/translate) must live on
                this inner element to avoid clobbering the masonry position.
                When the card is NOT tagged-out, this is a plain pass-through
                div with no className. */}
            <div
              className={shutdownClass}
              data-tagged-out={taggedOut ? 'true' : 'false'}
              style={{ position: 'absolute', inset: 0, borderRadius: 'var(--card-radius, 20px)' }}
            >
            <CardNode
              id={it.bookmarkId}
              title={it.title}
              thumbnailUrl={it.thumbnail}
            >
              {(() => {
                const Card = pickCard(it)
                return (
                  <Card
                    item={it}
                    persistMeasuredAspect={persistMeasuredAspect}
                    reportIntrinsicHeight={reportIntrinsicHeight}
                    cardWidth={p.w}
                    cardHeight={p.h}
                    displayMode={it.displayMode ?? displayMode}
                    autoCycle={motionEnabled}
                    ambientOn={ambientOn}
                    softShuffle={softShuffleSel.crossfade}
                    cycleMs={softShuffleSel.cadenceMs}
                    paper={meta.decorations === true}
                    photoHidden={isLightboxSource && isPaperWindowCard}
                  />
                )
              })()}
            </CardNode>
            {meta.decorations === true && (
              <PaperCardDecorations
                cardId={it.bookmarkId}
                tornBacking={tornBackingById.get(it.bookmarkId) ?? false}
              />
            )}
            {receiverMode && (() => {
              const tagIds = receiverMode.senderTagIdsByCard.get(it.url) ?? []
              if (tagIds.length === 0) return null
              return (
                <div className={styles.receiverOverlay} data-visible={hoverActive ? 'true' : 'false'}>
                  <div className={styles.senderTagRow}>
                    {tagIds.map((tid) => {
                      const tag = receiverMode.senderTags[tid]
                      if (!tag) return null
                      return <span key={tid} className={styles.senderTag}>{tag.n.toLowerCase()}</span>
                    })}
                  </div>
                </div>
              )
            })()}
            {receiverMode && (
              <CardCornerActions
                hovered={hoverActive}
                hasCustomWidth={false}
                onDelete={(): void => receiverMode.onRemove(it.url)}
                onResetSize={(): void => {}}
              />
            )}
            {audioActiveId === it.bookmarkId && canPlayInline(it) && (
              // Tier 3 inline player overlay. stopPropagation on pointerdown
              // so interacting with the player (scrub, volume, fullscreen)
              // never engages the card's reorder-drag / open-lightbox gesture
              // wired on the wrapper above.
              <div
                onPointerDown={(e: PointerEvent<HTMLDivElement>): void => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  // Paper theme: inset to the parchment photo window so the
                  // player sits framed inside the mat (border + caption stay
                  // visible). Default theme: token undefined → 0 (full-bleed,
                  // unchanged).
                  inset: 'var(--paper-frame-inset, 0)',
                  // Above the card visual, below the resize handle (z 30),
                  // media indicator (z 50) and corner actions so those stay
                  // operable while the player is mounted.
                  zIndex: 10,
                  overflow: 'hidden',
                  borderRadius: 'var(--card-radius, 20px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <InlineMediaPlayer item={it} volume={audioVolume} paused={audioPaused} />
              </div>
            )}
            {motionEnabled && playing.has(it.bookmarkId) && audioActiveId !== it.bookmarkId && canViewportAutoplay(it) && !unplayableIds.has(it.bookmarkId) && (
              // Tier 1 muted viewport autoplay (rotating spotlight). pointerEvents:none
              // so it never blocks card clicks / resize. Excluded on the Tier 3 sound-on
              // card and on cards marked unplayable. Shown immediately (same as every
              // other video — YouTube's brief start-up glyph is accepted); when the
              // spotlight rotates it out it unmounts, revealing the still thumbnail.
              <div
                data-viewport-playback
                style={{
                  position: 'absolute',
                  inset: 'var(--paper-frame-inset, 0)',
                  zIndex: 10,
                  overflow: 'hidden',
                  borderRadius: 'var(--card-radius, 20px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                <InlineMediaPlayer
                  item={it}
                  muted
                  onUnplayable={(): void => markUnplayable(it.bookmarkId)}
                />
              </div>
            )}
            {ambientOn && candidates.has(it.bookmarkId) && !playing.has(it.bookmarkId) && audioActiveId !== it.bookmarkId && (
              // Ambient still-frame slideshow on in-view video cards that
              // AREN'T the single hero (playing) and aren't the sound-on Tier 3
              // card. Sits just below the hero/Tier-3 overlay (z 10) and is
              // non-interactive so it never blocks card clicks / resize. When
              // the card scrolls out of `candidates` or becomes the hero, this
              // unmounts and the resting CardNode thumbnail shows through.
              <div
                data-card-slideshow
                style={{
                  position: 'absolute',
                  inset: 'var(--paper-frame-inset, 0)',
                  zIndex: 9,
                  overflow: 'hidden',
                  borderRadius: 'var(--card-radius, 20px)',
                  pointerEvents: 'none',
                }}
              >
                <CardSlideshow
                  frames={resolveSlideshowFrames(it)}
                  tweetVideoExtraction={resolveTweetVideoExtraction(it)}
                  scrollingActive={isScrolling}
                />
              </div>
            )}
            {barMount?.id === it.bookmarkId && canPlayInline(it) && (
              // Mixer-tone control bar attached to the active card's bottom.
              // Mounted by barMount (which lingers through the close so the
              // node — and thus its tuck-out transition — survives). `visible`
              // additionally requires the card to be active AND hovered, so on
              // ■-stop visible flips false and the bar tucks back into the card
              // before unmounting. Because the bar is a DOM descendant of the
              // wrapper and touches the card (top:100%, no gap), moving the
              // pointer card→bar stays "inside" the wrapper, so
              // hoveredBookmarkId remains set over the bar too.
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 60,
                }}
              >
                <PlaybackControlBar
                  volume={audioVolume}
                  paused={audioPaused}
                  onVolumeChange={onAudioVolumeChange}
                  onTogglePause={onAudioTogglePause}
                  visible={audioActiveId === it.bookmarkId && hoverActive}
                  widthPx={Math.max(p.w, MIN_CONTROL_BAR_WIDTH_PX)}
                />
              </div>
            )}
            {/* Only playable cards (video / audio) get a corner indicator —
                it's now a pressable play/audio toggle. Photo / text / non-
                playable (e.g. Instagram link-out) cards show nothing on hover:
                a non-pressable badge was just noise once the playable ones got
                a clear button. */}
            {canPlayInline(it) && (
              <MediaTypeIndicator
                type={deriveMediaType(it)}
                visible={hoverActive}
                onActivate={(): void => onToggleAudio(it.bookmarkId)}
                active={audioActiveId === it.bookmarkId}
              />
            )}
            {/* CardCornerActions renders BEFORE ResizeHandle so the corner
                arcs can pick up button hover via the ~ sibling combinator
                (see ResizeHandle.module.css cross-module rules). Without
                this ordering, hovering × or ↺ silences the resize hint
                arcs in the corners they cover. */}
            {!receiverMode && (
              <>
                <CardCornerActions
                  hovered={hoverActive}
                  hasCustomWidth={it.customCardWidth}
                  inTrash={inTrash}
                  onDelete={(): void => onDelete(it.bookmarkId)}
                  onResetSize={(): void => onCardResetSize(it.bookmarkId)}
                />
                <ResizeHandle
                  cardWidth={p.w}
                  cardHeight={p.h}
                  maxCardWidth={viewportWidth}
                  onResize={(nextW: number): void => onCardResize(it.bookmarkId, nextW)}
                  onResizeEnd={(finalW: number): void => onCardResizeEnd(it.bookmarkId, finalW)}
                />
              </>
            )}
            {/* Per-card tag pills, bleeding off the card's top-left corner.
                Renders only when the bookmark actually has tags AND the card
                is hovered (= silent-board principle — meta UI stays invisible
                at rest). Pills click → toggle in the board-wide tag filter,
                same semantics as the chrome TagFilterBar chips. */}
            {!receiverMode && !taggedOut && it.tags.length > 0 && onTagFilterToggle !== undefined && (
              <TagIndicatorStrip
                tags={it.tags
                  .map((tid) => tagsById.get(tid))
                  .filter((t): t is TagRecord => t !== undefined)}
                // Force-visible during the onboarding tag scene so the freshly
                // typed 'sample' pill is actually seen landing on the card
                // (otherwise the hover-gated strip stays at opacity 0 because the
                // user is behind the spotlight, not hovering the card).
                isHovered={hoverActive || forceTagButtonVisible}
                onTagClick={(tagId): void => onTagFilterToggle?.(tagId, it.bookmarkId)}
                onTagContextMenu={onTagContextMenu}
                activeContextTagId={activeContextTagId}
              />
            )}
            {/* + TAG affordance — top-left corner, mirrors the visual language
                of the existing × / ↺ corner buttons. Hidden by default;
                fades in while the card is hovered OR while its popover is
                open (so the trigger stays anchored under the user's eye
                while they're choosing a tag). pointerdown swallow so a
                click doesn't engage the card-reorder drag underneath. */}
            {!receiverMode && !taggedOut && allTags !== undefined && onTagToggle !== undefined && onTagCreate !== undefined && (
              <>
                <button
                  type="button"
                  className={styles.addTagButton}
                  data-testid="card-add-tag-button"
                  data-onboarding-target="card-tag"
                  aria-label="Add tag"
                  onPointerDown={(e: PointerEvent<HTMLButtonElement>): void => e.stopPropagation()}
                  onMouseDown={(e): void => e.stopPropagation()}
                  onMouseEnter={cancelPopoverClose}
                  onMouseLeave={schedulePopoverClose}
                  onClick={(e): void => {
                    e.stopPropagation()
                    if (popoverOpenFor === it.bookmarkId) beginPopoverClose()
                    else openPopoverFor(it.bookmarkId)
                  }}
                  style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    appearance: 'none',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 0,
                    color: 'rgba(255, 255, 255, 0.94)',
                    // 2-tier text-shadow recipe shared with TagIndicatorStrip
                    // and CardCornerActions (× / ↺ use the SVG filter variant).
                    // Tight drop + soft halo = readable on any background.
                    // Replaces the mix-blend Plan A which had per-photo
                    // legibility hiccups (session 73 feedback).
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.65), 0 0 4px rgba(0, 0, 0, 0.35)',
                    padding: '4px 6px',
                    fontFamily: 'ui-monospace, "SF Mono", Consolas, monospace',
                    fontSize: 10,
                    letterSpacing: '0.10em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    opacity: !isLightboxSource && (hoverActive || popoverOpenFor === it.bookmarkId || forceTagButtonVisible) ? 1 : 0,
                    transition:
                      'opacity 120ms, transform 160ms cubic-bezier(0.16, 1, 0.3, 1), filter 160ms cubic-bezier(0.16, 1, 0.3, 1)',
                    pointerEvents: !isLightboxSource && (hoverActive || popoverOpenFor === it.bookmarkId || forceTagButtonVisible) ? 'auto' : 'none',
                    zIndex: 40,
                  }}
                >
                  + TAG
                </button>
                {popoverOpenFor === it.bookmarkId && (
                  <div
                    onPointerDown={(e: PointerEvent<HTMLDivElement>): void => e.stopPropagation()}
                    onMouseDown={(e): void => e.stopPropagation()}
                    onMouseEnter={cancelPopoverClose}
                    onMouseLeave={schedulePopoverClose}
                    style={{
                      position: 'absolute',
                      top: 36,
                      left: 8,
                      zIndex: 70,
                    }}
                  >
                    <TagAddPopover
                      allTags={allTags}
                      currentTagIds={it.tags}
                      suggestedEntries={openPopoverSuggestions}
                      closing={popoverClosing}
                      onExited={finishPopoverClose}
                      onAddExisting={(tagId): void => { void onTagToggle(it.bookmarkId, tagId) }}
                      onAddNew={(name): void => {
                        void onTagCreate(it.bookmarkId, name)
                        beginPopoverClose()
                      }}
                      onClose={beginPopoverClose}
                    />
                  </div>
                )}
              </>
            )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
