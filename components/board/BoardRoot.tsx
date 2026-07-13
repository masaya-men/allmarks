'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { computeSkylineLayout, type SkylineCard } from '@/lib/board/skyline-layout'
import { itemSkylineHeight } from './cards'
import { computeFocusScrollY } from '@/lib/board/scroll-to-card'
import { shouldShowScrollMeter } from '@/lib/board/scroll-meter-visibility'
import {
  DEFAULT_THEME_ID,
  getThemeMeta,
} from '@/lib/board/theme-registry'
import { resolveThemeId } from '@/lib/board/theme-resolve'
import { EMPTY_LICENSES } from '@/lib/board/theme-entitlement'
import type { ThemeId, ThemeCustomization } from '@/lib/board/types'
import { resolveThemeCustomization, isDefaultCustomization, isLightColor, effectivePatternStroke } from '@/lib/board/theme-customization'
import { BOARD_INNER, BOARD_SLIDERS, BOARD_TOP_PAD_PX, BOARD_Z_INDEX, ARRANGE_SAFE_INSET, CANVAS_MARGIN_PX, MOBILE_LAYOUT } from '@/lib/board/constants'
import { useIsMobile } from '@/lib/board/use-is-mobile'
import { getDefaultVolume } from '@/lib/embed/default-volume'
import type { BoardFilter, CardPosition, DisplayMode } from '@/lib/board/types'
import { applyFilter } from '@/lib/board/filter'
import { useBoardData } from '@/lib/storage/use-board-data'
import { RevalidationQueue, defaultFetcher, shouldRevalidate } from '@/lib/board/revalidate'
import { createCompositeFetcher } from '@/lib/board/tweet-liveness'
import { subscribeBookmarkSaved, subscribeBookmarkUpdated, postBookmarkSaved } from '@/lib/board/channel'
import { detectUrlType, extractTweetId } from '@/lib/utils/url'
import { fetchTweetMeta } from '@/lib/embed/tweet-meta'
import { createBackfillQueue } from '@/lib/board/backfill-queue'
import { backfillTweetMeta } from '@/lib/board/tweet-backfill'
import { fetchTikTokMeta } from '@/lib/embed/tiktok-meta'
import { useTags } from '@/lib/storage/use-tags'
import { nextTagOrderMode } from '@/lib/board/tag-order'
import { computeTagAssignments } from '@/lib/board/tag-assign'
import {
  BOARD_FILTER_ALL,
  boardFilterEquals,
  isTagsFilter,
  toggleTagInFilter,
} from '@/lib/board/board-filter-helpers'
import { initDB } from '@/lib/storage/indexeddb'
import { loadBoardConfig, saveBoardConfig } from '@/lib/storage/board-config'
import { loadQuickTagEnabled, saveQuickTagEnabled } from '@/lib/storage/quick-tag-setting'
import { ThemeLayer } from './ThemeLayer'
import themeStyles from './themes.module.css'
import {
  BoardBackgroundTypography,
  deriveBoardBgTypoText,
  isBoardBgTypoVariant,
  type BoardBgTypoVariant,
} from './BoardBackgroundTypography'
import { gsap } from 'gsap'
import { CardsLayer } from './CardsLayer'
import { BoardMobileNav } from './BoardMobileNav'
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
import { ChromeLedToggle } from './ChromeLedToggle'
import { TuneTrigger } from './TuneTrigger'
import { ExtensionEntry } from './ExtensionEntry'
import { ThemeModal } from './ThemeModal'
import { ChromeButton } from './ChromeButton'
import { ScrollMeter } from './ScrollMeter'
import { TagDropPanel } from './TagDropPanel'
import { BoardMobileTagBar } from './BoardMobileTagBar'
import { BoardChrome } from './BoardChrome'
import { PaperFramePlate } from './chrome/PaperFramePlate'
import { PaperWaxSeal } from './chrome/PaperWaxSeal'
import { UndoToast, type UndoToastInput } from './UndoToast'
import { useUrlPasteSave } from '@/lib/board/use-url-paste-save'
import { useSaveUrl } from '@/lib/board/use-save-url'
import { useIsTouchDevice } from '@/lib/board/use-is-touch-device'
import { MobileSaveButton } from './MobileSaveButton'
import { MobileSaveSheet } from './MobileSaveSheet'
import { normalizeToUrl } from '@/lib/board/paste-url'
import { PasteSaveFeedback } from './PasteSaveFeedback'
import { ShareCreatingIndicator } from './ShareCreatingIndicator'
import { type UndoEntry, MAX_UNDO_STACK, pushBounded } from '@/lib/board/undo-stack'
import { PRESETS, type PresetId } from '@/lib/board/tune-presets'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { BookmarkletInstallModal } from '@/components/bookmarklet/BookmarkletInstallModal'
import { EmptyStateWelcome } from '@/components/bookmarklet/EmptyStateWelcome'
import { OnboardingController } from '@/components/onboarding/OnboardingController'
import { shouldAutoStartOnboarding } from '@/lib/onboarding/onboarding-state'
import type { SceneId } from '@/lib/onboarding/steps'
import { seedOnboardingDemo, clearOnboardingDemo } from '@/lib/onboarding/onboarding-demo'
import type { IDBPDatabase } from 'idb'
import { LanguageSwitcher } from './LanguageSwitcher'
import { Lightbox } from './Lightbox'
import { PipPortal } from '@/components/pip/PipPortal'
import { PipCompanion } from '@/components/pip/PipCompanion'
import { usePipWindow } from '@/lib/board/pip-window'
import { SenderShareModal } from '@/components/share/SenderShareModal'
import { buildShareDataFromBoard } from '@/lib/share/board-to-share'
import type { ShareDataV2 } from '@/lib/share/types-v2'
import { createHostedShare } from '@/lib/share/create-hosted-share'
import { captureCollageShareImage, type CaptureAttempt } from '@/lib/share/capture-collage'
import {
  clearCaptureBreadcrumb,
  readStaleCaptureBreadcrumb,
  writeCaptureBreadcrumb,
  type CaptureBreadcrumb,
} from '@/lib/share/capture-breadcrumb'
import { rewriteToProxy } from '@/lib/share/proxy-image'
import { renderCollageCanvasToJpeg, type CollageCanvasCard } from '@/lib/share/collage-canvas-render'
import { cardCornerRadiusPx } from '@/lib/board/card-radius'
import { shareImageFilename } from '@/lib/share/share-image-filename'
import { buildTweetIntentUrl } from '@/lib/share/share-actions'
import { createShare } from '@/lib/share/api-client'
import type { MirrorItem, MirrorPosition } from '@/components/share/ShareMirror'
import { addAllVisible, selectedInBoardOrder, toggleSelection } from '@/lib/share/selection'
import { ShareSelectBar } from '@/components/board/ShareSelectBar'
import { CollageCanvas } from '@/components/board/CollageCanvas'
import { MobileBandOverlay } from './MobileBandOverlay'
import { MobileArrangeDock } from './MobileArrangeDock'
import { MobileArrangeToast } from './MobileArrangeToast'
import { MobileArrangeGestures } from './MobileArrangeGestures'
import {
  createCollageGestureArbiter,
  IDENTITY_STAGE_TRANSFORM,
  zoomStageToScale,
  type CollageGestureArbiter,
  type StagePoint,
  type StageTransform,
} from '@/lib/share/stage-zoom'
import { ShareToast } from '@/components/board/ShareToast'
import { MobileShareSelectBar } from '@/components/board/MobileShareSelectBar'
import { MobileShareResult } from '@/components/board/MobileShareResult'
import { CaptureCrashNotice } from '@/components/board/CaptureCrashNotice'
import { mobileCaptureScale, SHARE_OG_ASPECT, SHARE_PORTRAIT_ASPECT, mobileCollagePortraitBandRect } from '@/lib/share/mobile-band'
import { letterboxImageToAspect } from '@/lib/share/letterbox'
import { moveElement, resizeElementFromCorner, bringToFront, fitSelectionToScreen, scaleElementFromCenter, type CollagePositions, type CollageFitRect } from '@/lib/share/collage-layout'
import { sendToBack } from '@/lib/share/collage-layer-order'
import { removeFromCollage } from '@/lib/share/collage-remove'
import { snapshotsEqual, pushSnapshot, MAX_COLLAGE_HISTORY, type CollageSnapshot } from '@/lib/share/collage-history'
import { defaultShareTitleConfig, type ShareTitleConfig } from '@/lib/share/share-title'
import { usePaperParallax, PAPER_PARALLAX_FACTOR } from './use-paper-parallax'
import { useGrabWiggle } from './use-grab-wiggle'
import { GRAB_LAYER_WEIGHTS } from '@/lib/board/rubber-band'
import { BoardDecorLayer } from './BoardDecorLayer'
import { DataHomeCard } from './DataHomeCard'
import { BackupReminder } from './BackupReminder'
import { exportBackupFile } from '@/lib/board/export-backup'
import {
  loadDataHomeAck, markDataHomeAck, loadLastBackupAt,
  loadNudgeDismissedAt, markNudgeDismissed,
  countSavedAfter, shouldShowBackupReminder,
} from '@/lib/storage/backup-reminder'
import styles from './BoardRoot.module.css'

/** Paper middle-scatter layer pan speed, as a fraction of the card scroll. 0.30
 *  = the scatter travels at 30% of card speed (lags by 70% of scroll) = strong
 *  parallax. Also drives the scatter DISTRIBUTION band: because the layer moves
 *  this slowly, only content-y up to `viewportH + 0.30·(contentH − viewportH)`
 *  ever crosses the viewport, so we scatter items across exactly that band (not
 *  the full content height) for uniform on-screen density with no wasted items. */
const DECOR_PARALLAX_FACTOR = 0.30

/** grid-paper background drift. usePaperParallax returns viewportY * (1 − factor),
 *  so `1 − PAPER_PARALLAX_FACTOR` makes the grid move at exactly the same speed
 *  as the paper-atelier backdrop (0.15× the card scroll = a slow, deep drift).
 *  Applied as background-position-y on the viewport-anchored grid layer (NOT a
 *  translate — the layer is screen-fixed so it stays centred + symmetric). */
const GRID_BG_PARALLAX_FACTOR = 1 - PAPER_PARALLAX_FACTOR

/** Edge-band chrome (wordmark / MOTION / the FilterPill count readout) is tuned
 *  light-on-dark. On a LIGHT custom edge, flip the WHOLE chrome token family —
 *  both the ChromeButton vars (--chrome-btn-*) AND the FilterPill text vars
 *  (--chrome-text-*, which also carry a dark glow text-shadow) — to dark ink +
 *  a light stroke + no glow, so every edge-band label stays legible and matches. */
const LIGHT_EDGE_CHROME = {
  '--chrome-btn-color': 'rgba(24, 22, 20, 0.9)',
  '--chrome-btn-color-hover': 'rgba(24, 22, 20, 1)',
  '--chrome-btn-stroke-color': 'rgba(255, 255, 255, 0.45)',
  '--chrome-text-color': 'rgba(24, 22, 20, 0.92)',
  '--chrome-text-color-hover': 'rgba(24, 22, 20, 1)',
  '--chrome-text-stroke-color': 'rgba(255, 255, 255, 0.6)',
  '--chrome-text-stroke-color-hover': 'rgba(255, 255, 255, 0.75)',
  '--chrome-text-shadow': 'none',
} as CSSProperties

/** Reset the chrome token family to the dark-theme defaults (globals.css :root)
 *  on the inner canvas, so the LIGHT_EDGE_CHROME cascade from .outerFrame never
 *  reaches the header / card chrome that sits on the dark board. */
const DARK_CHROME_RESET = {
  '--chrome-btn-color': 'rgba(255, 255, 255, 0.85)',
  '--chrome-btn-color-hover': 'rgba(255, 255, 255, 1)',
  '--chrome-btn-stroke-color': 'rgba(0, 0, 0, 0.45)',
  '--chrome-text-color': 'rgba(255, 255, 255, 0.92)',
  '--chrome-text-color-hover': 'rgba(255, 255, 255, 1)',
  '--chrome-text-stroke-color': 'rgba(0, 0, 0, 0.6)',
  '--chrome-text-stroke-color-hover': 'rgba(0, 0, 0, 0.75)',
  '--chrome-text-shadow': '0 0 4px rgba(0, 0, 0, 0.55), 0 1px 2px rgba(0, 0, 0, 0.45)',
} as CSSProperties

// Horizontal room past the rightmost card so the user can scroll a little
// further right. Vertical bottom room is computed per-render from the viewport
// height (see contentBounds); the fraction below stops the last card around
// screen-center instead of letting it scroll off the top. Tune up (0.7–0.85)
// to allow scrolling until the last card is cut off near the top edge.
const SCROLL_OVERFLOW_MARGIN_X = 600
const BOTTOM_OVERSCROLL_FRACTION = 0.5
/** Min width change (px) before a live resize re-runs the full masonry layout.
 *  Gates out micro-jitter frames during a drag; the exact final width is still
 *  committed on pointerup (rank29). */
const RESIZE_GATE_PX = 8
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

/** Unified right-drawer state (TUNE/SETTINGS/THEMES) — only one panel open at
 *  a time. Only 'themes' is wired through this today; the others migrate onto
 *  ChromeDrawer in follow-up tasks. The old 'share' drawer was retired when
 *  SHARE became the two-stage select→arrange collage mode (sharePhase). */
type ActiveDrawer = 'tune' | 'settings' | 'themes' | null

/** How long the background-typography (TITLE) node lingers, mounted, after the
 *  user turns it OFF so the CRT shutdown can play, before the parent unmounts
 *  it. = the shutdown duration (--tag-shutdown-duration 0.55s) + a small buffer.
 *  The unmount is driven by THIS timer, never by the animation's finish event,
 *  so visibility stays a pure function of state (session 94 reliability rule). */
const BG_TYPO_SHUTDOWN_MS = 620

/** Stable empty map passed as `customWidths` on mobile so per-card free-resize
 *  widths are ignored (uniform N-column masonry). Module-scope = stable ref, so
 *  it never re-triggers the layout memos. */
const EMPTY_CUSTOM_WIDTHS: Readonly<Record<string, number>> = {}

export function BoardRoot() {
  const { t } = useI18n()
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
    persistTags,
    persistSoftDelete,
    emptyTrash,
    persistCustomWidth,
    resetCustomWidth,
    resetAllCustomWidths,
    resortNewestFirst,
    reload,
    persistLinkStatus,
  } = useBoardData()
  const {
    tags, create: createTag, reload: reloadTags, remove: removeTag, rename: renameTag, reorder: reorderTags,
    orderMode: tagOrderMode, setOrderMode: setTagOrderMode,
  } = useTags()
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
  // Seeded from the localStorage theme cache (mirrored in the effect below) so
  // the first client paint matches the pre-paint inline script in (app)/layout —
  // no flash of the default theme for users who saved a non-default one. IDB
  // (loadBoardConfig) is the source of truth and reconciles this right after.
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    if (typeof window === 'undefined') return DEFAULT_THEME_ID
    try {
      return resolveThemeId(window.localStorage.getItem('allmarks-theme-id') ?? undefined, EMPTY_LICENSES)
    } catch {
      return DEFAULT_THEME_ID
    }
  })
  // Per-theme customizations for 'pattern' themes (edge/board/pattern colour +
  // pattern type/density). Hydrated from BoardConfig; absent key = theme defaults.
  const [themeCustomizations, setThemeCustomizations] =
    useState<Partial<Record<ThemeId, ThemeCustomization>>>({})
  // While the onboarding tag scene is active, force the hover-gated card +TAG
  // button visible (the user can't hover precisely through the spotlight hole).
  const [forceCardTagVisible, setForceCardTagVisible] = useState<boolean>(false)
  // Bumped each time a tag is ADDED to a card from the board UI. The onboarding
  // tag scene watches this to advance — the board's own tag-add doesn't post to
  // the bookmark-updated channel (it reloads locally), so the scene needs a
  // direct in-process signal.
  const [tagAddedTick, setTagAddedTick] = useState<number>(0)
  // Background typography (the big wordmark / filter title behind the cards)
  // master switch. Persisted in BoardConfig; the share image follows it too.
  const [bgTypoEnabled, setBgTypoEnabled] = useState<boolean>(true)
  // Card corner style (TUNE → CORNERS switch). true = rounded, false = square.
  // Default true so the initial render matches the current look; the persisted
  // BoardConfig reconciles it on hydrate. Flows into CardsLayer's per-card
  // --card-radius.
  const [roundedCorners, setRoundedCorners] = useState<boolean>(true)
  // True once the user has toggled TITLE this session, so the boot-up effect
  // plays on a user toggle but NOT on the initial page load / config hydration.
  const [bgTypoUserToggled, setBgTypoUserToggled] = useState<boolean>(false)
  // Render state for the TITLE wordmark, lagging behind `bgTypoEnabled` so the
  // exit (CRT shutdown) can play before the node unmounts. This mirrors the
  // proven control-bar pattern in CardsLayer (barMount): `bgTypoEnabled` is the
  // source of truth, this is just "is the node on screen, and is it leaving".
  //   null              → not rendered (TITLE off, at rest)
  //   { closing:false } → rendered + visible (TITLE on)
  //   { closing:true }  → rendered, playing the shutdown, will unmount on a timer
  // Visibility is therefore a pure function of state (mounted == visible); the
  // animation is decoration only. Init from the default-on state.
  const [bgTypoMount, setBgTypoMount] = useState<{ closing: boolean } | null>(
    () => (bgTypoEnabled ? { closing: false } : null),
  )
  const prevBgTypoEnabledRef = useRef<boolean>(bgTypoEnabled)
  const bgTypoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const prev = prevBgTypoEnabledRef.current
    prevBgTypoEnabledRef.current = bgTypoEnabled
    if (bgTypoEnabled) {
      // Turning on (or re-showing mid-close): cancel any pending unmount and
      // mount fresh so the boot-up entry plays.
      if (bgTypoCloseTimerRef.current) {
        clearTimeout(bgTypoCloseTimerRef.current)
        bgTypoCloseTimerRef.current = null
      }
      setBgTypoMount({ closing: false })
    } else if (prev && bgTypoUserToggled) {
      // User just turned TITLE off → keep it mounted, play the card shutdown,
      // then unmount on a fixed timer (NOT on the animation's finish event).
      setBgTypoMount({ closing: true })
      if (bgTypoCloseTimerRef.current) clearTimeout(bgTypoCloseTimerRef.current)
      bgTypoCloseTimerRef.current = setTimeout(() => {
        setBgTypoMount(null)
        bgTypoCloseTimerRef.current = null
      }, BG_TYPO_SHUTDOWN_MS)
    } else {
      // Hydrated to off, or already off → just hidden, no animation.
      setBgTypoMount(null)
    }
  }, [bgTypoEnabled, bgTypoUserToggled])
  useEffect(
    () => (): void => {
      if (bgTypoCloseTimerRef.current) clearTimeout(bgTypoCloseTimerRef.current)
    },
    [],
  )
  const [viewport, setViewport] = useState({ x: 0, y: 0, w: 1200, h: 800 })
  // Mirror viewport in a ref so the edge auto-scroll rAF tick (which fires
  // outside React's render cycle) can read the latest scroll position
  // without going through stale closures.
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport
  // Mobile native scroll: the real overflow container that owns touch scrolling
  // (built below, mobile only). Its scrollTop is mirrored into viewport.y so the
  // background / culling / deep-links keep following, exactly as on desktop.
  const mobileScrollRef = useRef<HTMLDivElement | null>(null)

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
  // Unified right-drawer state (TUNE/SETTINGS/SHARE/THEMES) — only one open at
  // a time. THEMES and SHARE are wired through this; the SETTINGS/TUNE hover
  // state migrates in later tasks.
  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>(null)
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
  // SHARE collage mode (spec 2026-07-05). sharePhase drives the two-stage flow:
  //   'select'  = tap-to-select cards on the board (ShareSelectBar visible)
  //   'arrange' = free-placement collage canvas + ShareToast (screenshot stage)
  //   null      = not sharing (normal board)
  // selectedIds = the working selection carried across both stages.
  // shareSelectedIds = legacy confirmed selection kept only for the dormant
  // SenderShareModal helper (phase 3 reuse); null in the phase-1 flow.
  // selectionScrollY = the (dormant) modal preview's local scroll for a selection.
  const [sharePhase, setSharePhase] = useState<'select' | 'arrange' | null>(null)
  // TAG MODE (drag-drop tagging) — in-page replacement for the Triage manage
  // page. Reuses the SHARE selection machinery (selectedIds + handleSelectToggle).
  const [tagMode, setTagMode] = useState<boolean>(false)
  // Phase 3: pending "+ NEW TAG" inline create. Holds the cards the tag will be
  // assigned to once the name is committed. null = the create input is closed.
  const [tagDraft, setTagDraft] = useState<{ readonly cardIds: readonly string[] } | null>(null)
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  // Free-placement layout for the arrange stage (owned here, passed to
  // CollageCanvas). Discarded on exit — the temporary collage is never persisted.
  const [collagePositions, setCollagePositions] = useState<CollagePositions>({})
  const [collageOrder, setCollageOrder] = useState<string[]>([])
  // Free per-card rotation (deg) for the arrange stage. Collage-only tilt — the
  // board grid never rotates. Discarded on exit like the rest of the temp state.
  const [collageRotations, setCollageRotations] = useState<Record<string, number>>({})
  // スマホ編集段の帯（.outerFrame 座標）。ARRANGE 進入時に確定し、CREATE の撮影と
  // 帯ガイドの描画が同じ値を共有する。exit で null に戻す。
  const [mobileBandRect, setMobileBandRect] = useState<CollageFitRect | null>(null)
  // スマホ編集段: タップ選択のカード id（null=非選択）。2本指の行き先と選択枠を決める（N-58 段階2）。
  const [selectedCollageId, setSelectedCollageId] = useState<string | null>(null)
  // ボードのズーム/パン（編集専用・撮影に無影響）。段の出入りで IDENTITY に戻す。
  const [stageTransform, setStageTransform] = useState<StageTransform>(IDENTITY_STAGE_TRANSFORM)
  // 2本目の指で進行中のカード移動を止める調停役（インスタンスは1個を維持）。
  const [collageArbiter] = useState<CollageGestureArbiter>(() => createCollageGestureArbiter())
  // 選択カードのピンチ開始時の base（絶対計算で誤差を溜めないためのスナップショット）。
  const pinchBaseRef = useRef<{ positions: CollagePositions; rotation: number; id: string } | null>(null)
  // コラージュ編集の取り消し/やり直し履歴（stage2）。
  const [collageUndoStack, setCollageUndoStack] = useState<CollageSnapshot[]>([])
  const [collageRedoStack, setCollageRedoStack] = useState<CollageSnapshot[]>([])
  // カードを画像から外した直後の確認トースト（mobile-arrange-ux-redesign）。ARRANGE
  // 再入場・SHARE 全体終了で false に戻す（古いトーストが次のセッションに残らないように）。
  const [removeToast, setRemoveToast] = useState<boolean>(false)
  // 3マップの現在値（同期スナップショット捕捉用）。setState は非同期なので ref でミラー。
  const collageStateRef = useRef<CollageSnapshot>({ positions: {}, order: [], rotations: {} })
  // undo/redo スタックの ref ミラー（ハンドラ内で updater をネストしないため）。
  const collageUndoRef = useRef<CollageSnapshot[]>([])
  const collageRedoRef = useRef<CollageSnapshot[]>([])
  // 連続ジェスチャ開始時の「変更前」スナップショット（終了時に差分ありなら積む）。
  const pendingHistoryRef = useRef<CollageSnapshot | null>(null)
  // Editable collage title (phase 2). null while not arranging — seeded on
  // entering arrange, discarded on exit. Never persisted (matches the rest of
  // the temporary collage layout state above).
  const [shareTitle, setShareTitle] = useState<ShareTitleConfig | null>(null)
  // SHARE auto-capture (arrange stage): the auto-generated 1200×630 JPEG data-url
  // (dom-to-image of the real collage via the same-origin image proxy — kept for
  // the ready-state SAVE IMAGE download), the resulting hosted /s link, and the
  // create state. No manual screenshot: select → arrange → CREATE.
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null)
  const [hostedShareUrl, setHostedShareUrl] = useState<string | null>(null)
  const [shareCreateState, setShareCreateState] = useState<'idle' | 'creating' | 'error'>('idle')
  const [captureAttempts, setCaptureAttempts] = useState<readonly CaptureAttempt[] | null>(null)
  const [shareErrorMessage, setShareErrorMessage] = useState<string | null>(null)
  // N-56: a breadcrumb left over from a previous capture that never cleared it
  // means the tab crashed mid-capture (iOS OOM). Surface it once on load.
  const [captureCrash, setCaptureCrash] = useState<CaptureBreadcrumb | null>(null)
  useEffect((): void => {
    const stale = readStaleCaptureBreadcrumb()
    if (stale) {
      setCaptureCrash(stale)
      clearCaptureBreadcrumb()
    }
  }, [])
  // コラージュ3マップ・undo/redoスタックの ref ミラー（setState は非同期なので、
  // ハンドラが「今の値」を同期的に読むための同期先）。
  useEffect(() => {
    collageStateRef.current = { positions: collagePositions, order: collageOrder, rotations: collageRotations }
  }, [collagePositions, collageOrder, collageRotations])
  useEffect(() => { collageUndoRef.current = collageUndoStack }, [collageUndoStack])
  useEffect(() => { collageRedoRef.current = collageRedoStack }, [collageRedoStack])
  const [shareSelectedIds, setShareSelectedIds] = useState<ReadonlySet<string> | null>(null)
  const [selectionScrollY, setSelectionScrollY] = useState<number>(0)
  // Onboarding: true while the first-run tutorial overlay is active.
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false)
  // Resume target after the manage scene's /triage detour (undefined = start at
  // 'enter' for a normal first run / replay).
  const [onboardingInitialScene, setOnboardingInitialScene] = useState<SceneId | undefined>(undefined)
  // Read at save time by the paste handler + tag-create so anything saved/created
  // DURING the tutorial is flagged onboardingDemo and swept on completion. Kept
  // current via assignment below (refs don't need an effect for read-at-event).
  const onboardingActiveRef = useRef(false)
  onboardingActiveRef.current = showOnboarding
  // DB ref shared across onboarding helpers (populated on first initDB() call).
  const onboardingDbRef = useRef<DbLike | null>(null)
  // Backup safety UI (s161 T7): one-time "your data lives here" card, and a
  // periodic reminder toast when enough new saves have piled up unbacked.
  const [showDataHomeCard, setShowDataHomeCard] = useState<boolean>(false)
  const [backupReminder, setBackupReminder] =
    useState<{ newCount: number; everBackedUp: boolean } | null>(null)
  // One decision per board load; gates the effect below from re-firing on
  // every items/loading change once it has already run.
  const backupUiCheckedRef = useRef(false)
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

  // N-19: bulk-clear every card's manual resize, then confirm via toast.
  const handleResetCardSizes = useCallback(async (): Promise<void> => {
    const cleared = await resetAllCustomWidths()
    setToast({
      message: t('board.settings.resetSizesDone').replace('{n}', String(cleared.length)),
      nonce: Date.now(),
    })
  }, [resetAllCustomWidths, t])

  // N-19: re-sort the whole board to newest-first, then confirm via toast.
  const handleSortNewestFirst = useCallback(async (): Promise<void> => {
    await resortNewestFirst()
    setToast({ message: t('board.settings.sortNewestDone'), nonce: Date.now() })
  }, [resortNewestFirst, t])

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

  // N-19: number of cards currently on a manual custom width (drives the
  // SETTINGS RESET CARD SIZES button count + disabled state).
  const customWidthCount = useMemo(
    () => items.filter((it) => it.customCardWidth).length,
    [items],
  )

  // Live resize override during an in-flight drag. Holds at most ONE
  // entry (only the actively-dragged card needs it), so it doesn't
  // need a Map. Cleared on pointerup; the optimistic items update
  // inside `persistCustomWidth` carries the new width into
  // persistentCustomWidths in the same React batch.
  const [liveResize, setLiveResize] = useState<{ id: string; width: number } | null>(null)

  // rAF coalescing + movement gate for live resize. ResizeHandle fires onResize
  // on every pointermove and each setLiveResize drives a full masonry re-layout
  // (skylineCards → computeSkylineLayout → contentBounds), which is O(n) in card
  // count — costly on large boards (rank29). Two-part throttle: (1) coalesce to
  // at most one flush per frame, (2) skip the flush unless the width moved
  // ≥ RESIZE_GATE_PX since the last applied value, so micro-jitter / very slow
  // drag frames don't re-run the layout at all. The exact final width is still
  // committed on pointerup via handleCardResizeEnd.
  const resizeRafRef = useRef<number>(0)
  const pendingResizeRef = useRef<{ id: string; width: number } | null>(null)
  const lastFlushedResizeRef = useRef<{ id: string; width: number } | null>(null)

  // What the layout actually reads — persisted overrides, with the
  // live in-flight width layered on top for the dragging card.
  const customWidths = useMemo<Readonly<Record<string, number>>>(() => {
    if (!liveResize) return persistentCustomWidths
    return { ...persistentCustomWidths, [liveResize.id]: liveResize.width }
  }, [persistentCustomWidths, liveResize])

  const handleCardResize = useCallback((bookmarkId: string, nextWidth: number): void => {
    pendingResizeRef.current = { id: bookmarkId, width: nextWidth }
    if (resizeRafRef.current !== 0) return
    resizeRafRef.current = requestAnimationFrame(() => {
      resizeRafRef.current = 0
      const pending = pendingResizeRef.current
      if (!pending) return
      // Movement gate: a different card always flushes; otherwise only when the
      // width changed enough to matter. Skips the full relayout on jitter frames
      // (ResizeHandle's 2× sensitivity makes a 1px wiggle a 2px delta).
      const last = lastFlushedResizeRef.current
      if (
        last &&
        last.id === pending.id &&
        Math.abs(last.width - pending.width) < RESIZE_GATE_PX
      ) {
        return
      }
      lastFlushedResizeRef.current = pending
      setLiveResize((prev) =>
        prev?.id === pending.id && prev.width === pending.width ? prev : pending,
      )
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
      // Drop any coalesced resize still queued for this frame so it can't fire
      // after end and clobber the null/final state (rank29).
      if (resizeRafRef.current !== 0) {
        cancelAnimationFrame(resizeRafRef.current)
        resizeRafRef.current = 0
      }
      pendingResizeRef.current = null
      lastFlushedResizeRef.current = null
      // Clearing liveResize and queueing the optimistic items update
      // in the same task lets React batch them — no flicker between
      // the live drag and the persisted state taking over.
      setLiveResize(null)
      void persistCustomWidth(bookmarkId, finalWidth)
    },
    [persistCustomWidth, items, pushUndo],
  )

  // Cancel a dangling coalesced-resize rAF on unmount (rank29).
  useEffect(() => {
    return (): void => {
      if (resizeRafRef.current !== 0) cancelAnimationFrame(resizeRafRef.current)
    }
  }, [])

  const handleCardResetSize = useCallback(
    (bookmarkId: string): void => {
      // Mirror handleCardResizeEnd's rAF teardown so a queued live-resize flush
      // can't fire after a reset and reapply a stale width (rank29 symmetry).
      if (resizeRafRef.current !== 0) {
        cancelAnimationFrame(resizeRafRef.current)
        resizeRafRef.current = 0
      }
      pendingResizeRef.current = null
      lastFlushedResizeRef.current = null
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
      setBgTypoEnabled(cfg.bgTypoEnabled)
      setRoundedCorners(cfg.roundedCorners)
      setThemeId(resolveThemeId(cfg.themeId, EMPTY_LICENSES))
      setThemeCustomizations(cfg.themeCustomizations ?? {})
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

  // Reflect the active theme onto <html> so the [data-theme-id] cascade reaches
  // portalled UI (Lightbox / popovers) too. Cleared on unmount so leaving the
  // board (e.g. back to the LP) doesn't leave a stale attribute behind.
  useEffect(() => {
    const el = document.documentElement
    el.setAttribute('data-theme-id', themeId)
    // Mirror to a localStorage cache (NOT the source of truth — that's the IDB
    // BoardConfig) so the pre-paint inline script in (app)/layout can apply the
    // attribute before first paint and avoid a theme flash on reload.
    try {
      window.localStorage.setItem('allmarks-theme-id', themeId)
    } catch {
      // private mode / storage disabled — the IDB path still themes correctly.
    }
    return (): void => {
      el.removeAttribute('data-theme-id')
    }
  }, [themeId])

  // First-run onboarding gate: runs once when loading flips false and db is ready.
  // If the user has no bookmarks and hasn't completed onboarding, seeds demo cards
  // and launches the controller. If they've already completed, sweeps any leftover
  // demo cards from an abandoned run.
  useEffect(() => {
    if (loading) return
    let cancelled = false
    void (async (): Promise<void> => {
      const db = (await initDB()) as unknown as DbLike
      if (cancelled) return
      onboardingDbRef.current = db
      // RESUME after the manage scene navigated out to /triage and back. The
      // demo cards are still seeded from the original run, so DON'T sweep them
      // (items.length > 0 would otherwise make shouldAutoStartOnboarding false
      // and trigger the sweep) — re-open the tutorial at the saved scene.
      let resumeScene: string | null = null
      try { resumeScene = sessionStorage.getItem('allmarks-onboarding-resume') } catch { /* private mode */ }
      if (resumeScene) {
        try { sessionStorage.removeItem('allmarks-onboarding-resume') } catch { /* ignore */ }
        await reload()
        if (cancelled) return
        setOnboardingInitialScene(resumeScene as SceneId)
        setShowOnboarding(true)
        return
      }
      if (await shouldAutoStartOnboarding(db, items.length)) {
        // Mobile runs only enter->paste->finale (no tag/motion scenes), so the
        // demo cards have no scene to justify them — skip seeding so a mobile
        // first-timer pastes onto a board reflecting only their own action
        // (rather than a board full of art they didn't add that then vanishes).
        const onMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
        await seedOnboardingDemo(db, onMobile ? 0 : undefined)
        if (cancelled) return
        await reload()
        if (cancelled) return
        setShowOnboarding(true)
      } else {
        // Not auto-starting → any onboardingDemo cards present are leftovers
        // from an abandoned run (the user reloaded mid-tutorial). Demo cards
        // only ever exist while onboarding is showing, so sweep them now so
        // they never pollute the real board. Reload only if something was
        // actually removed, to avoid a needless board re-render on every load.
        const removed = await clearOnboardingDemo(db)
        if (cancelled) return
        if (removed > 0) await reload()
      }
    })()
    return (): void => { cancelled = true }
    // Once-only: runs when loading flips false for the first time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  // Seed demo cards, reload the board, and open the onboarding controller.
  // Used by EmptyStateWelcome's REPLAY INTRO and (Task 7) SETTINGS entry.
  const startOnboardingReplay = async (): Promise<void> => {
    const db = onboardingDbRef.current ?? ((await initDB()) as unknown as DbLike)
    onboardingDbRef.current = db
    const onMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
    await seedOnboardingDemo(db, onMobile ? 0 : undefined)
    await reload()
    setOnboardingInitialScene(undefined) // replay always starts from 'enter'
    setShowOnboarding(true)
  }

  // Backup safety UI (s161 T7): after onboarding (or immediately for
  // returning users), show the one-time data-home card; otherwise maybe the
  // periodic reminder. Runs once per board load (backupUiCheckedRef gates
  // re-firing on later loading/showOnboarding flips).
  useEffect(() => {
    if (loading || showOnboarding || backupUiCheckedRef.current) return
    backupUiCheckedRef.current = true
    let alive = true
    void (async (): Promise<void> => {
      const db = onboardingDbRef.current ?? ((await initDB()) as unknown as DbLike)
      const ack = await loadDataHomeAck(db)
      if (!alive) return
      if (ack === null) { setShowDataHomeCard(true); return }
      const lastBackupAt = await loadLastBackupAt(db)
      const nudgeDismissedAt = await loadNudgeDismissedAt(db)
      if (!alive) return
      // `items` (BoardItem, from useBoardData) doesn't carry `savedAt` — read
      // it straight from the bookmarks store instead, scoped to non-deleted
      // records (same "currently displayed" scope the design's count rule
      // uses for `items`).
      const activeBookmarks = (await db.getAll('bookmarks')) as { savedAt: string; isDeleted?: boolean }[]
      const savedAts = activeBookmarks.filter((b) => !b.isDeleted).map((b) => b.savedAt)
      const newCount = countSavedAfter(savedAts, lastBackupAt)
      const show = shouldShowBackupReminder({
        nowMs: Date.now(), newCount, lastBackupAt, dataHomeAck: ack, nudgeDismissedAt,
      })
      if (alive && show) setBackupReminder({ newCount, everBackedUp: lastBackupAt !== null })
    })()
    return (): void => { alive = false }
  }, [loading, showOnboarding])

  const onDataHomeGotIt = useCallback((): void => {
    setShowDataHomeCard(false)
    void (async (): Promise<void> => {
      const db = (await initDB()) as unknown as DbLike
      await markDataHomeAck(db, new Date().toISOString())
    })()
  }, [])

  const onReminderExport = useCallback((): void => {
    setBackupReminder(null)
    void (async (): Promise<void> => {
      try {
        const db = (await initDB()) as unknown as DbLike
        await exportBackupFile(db, new Date().toISOString())
      } catch {
        window.alert(t('board.backup.exportFailed'))
      }
    })()
  }, [t])

  const onReminderLater = useCallback((): void => {
    setBackupReminder(null)
    void (async (): Promise<void> => {
      const db = (await initDB()) as unknown as DbLike
      await markNudgeDismissed(db, new Date().toISOString())
    })()
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

  // Source-of-truth for the whole quick-tag-on-save feature. Loaded from app
  // IndexedDB (default ON); the SETTINGS panel toggles it and PiP reads it.
  const [quickTagEnabled, setQuickTagEnabled] = useState(true)
  useEffect(() => {
    let alive = true
    void (async (): Promise<void> => {
      const db = await initDB()
      const v = await loadQuickTagEnabled(db)
      if (alive) setQuickTagEnabled(v)
    })()
    return (): void => { alive = false }
  }, [])
  const handleQuickTagToggle = useCallback(async (next: boolean): Promise<void> => {
    setQuickTagEnabled(next) // optimistic — the toggle reflects immediately
    try {
      const db = await initDB()
      await saveQuickTagEnabled(db, next)
    } catch (err) {
      // An IDB write effectively never fails, so we keep the optimistic value
      // rather than rolling back (a flicker would be more confusing). Log so a
      // genuine failure leaves a trail for debugging.
      console.error('[AllMarks] failed to persist quick-tag setting', err)
    }
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

  // Lightbox left/right (chevron / wheel / meter) navigation scope. With a tag
  // filter active the board keeps the non-matching cards MOUNTED (for the CRT
  // shutdown animation) but hides them from the masonry, so `filteredItems`
  // still contains them. The Lightbox must step through ONLY the cards the user
  // actually sees — the matched set — otherwise nav walks into tagged-out cards
  // that aren't on the board (the reported bug). No tag filter → identical to
  // filteredItems.
  const lightboxNavItems = useMemo(() => {
    if (matchedBookmarkIds == null) return filteredItems
    return filteredItems.filter((it) => matchedBookmarkIds.has(it.bookmarkId))
  }, [filteredItems, matchedBookmarkIds])

  const themeMeta = getThemeMeta(themeId)
  // Parallax depth is independent of the MOTION toggle. MOTION only stops card
  // autoplay / slideshow; parallax is "how the depth reads", not a motion effect,
  // so it stays on regardless (the hook only drops to 0 for non-parallax themes
  // or OS prefers-reduced-motion).
  const paperParallaxY = usePaperParallax({ themeId, viewportY: viewport.y })
  // Middle scatter layer pans at 0.30x the card speed (lags by 70% of scroll)
  // for a strong, clearly-felt depth read — much slower than cards, a touch
  // faster than the near-static bg stains (0.15x). See DECOR_PARALLAX_FACTOR.
  const decorParallaxY = usePaperParallax({ themeId, viewportY: viewport.y, factor: DECOR_PARALLAX_FACTOR })
  // grid-paper: the grid lives on a viewport-anchored layer (see render below),
  // so it drifts via background-position-y instead of a translated layer.
  // Returns viewport.y * (1 − factor) = the grid's drift, matching the paper
  // backdrop's 0.15× speed.
  const gridBgPanY = usePaperParallax({ themeId, viewportY: viewport.y, factor: GRID_BG_PARALLAX_FACTOR })

  // ── Mobile layout override (A1) ──────────────────────────────────────────
  // On a narrow viewport the board renders a uniform N-column masonry sized to
  // the (already-thinner) canvas, ignoring the desktop card-width/gap dial and
  // per-card free-resize widths. This is DISPLAY-ONLY: cardWidthPx / cardGapPx /
  // customWidths in IDB+localStorage are never mutated, so the user's desktop
  // arrangement is preserved and simply overridden while the viewport is narrow.
  const isMobile = useIsMobile()

  // Cards span the full width of the inner dark canvas with a destefanis-
  // style half-gap on each side (SIDE_PADDING_PX = COLUMN_MASONRY.GAP_PX / 2).
  // No sidebar reservation, no max-width cap — the canvas is the whole stage.
  // A phone takes a wider margin so the board's theme reads at the edges (N-51).
  const layoutSidePaddingPx = isMobile ? MOBILE_LAYOUT.SIDE_MARGIN_PX : BOARD_INNER.SIDE_PADDING_PX
  const effectiveLayoutWidth = Math.max(0, viewport.w - 2 * layoutSidePaddingPx)

  const mobileCardWidth = useMemo<number>(() => {
    const cols = MOBILE_LAYOUT.COLUMNS
    return Math.max(1, (effectiveLayoutWidth - (cols - 1) * MOBILE_LAYOUT.GAP_PX) / cols)
  }, [effectiveLayoutWidth])
  // Effective values fed to every on-board geometry path (board scroll bounds,
  // CardsLayer render, Lightbox FLIP) so layout and render never diverge.
  const layoutCardWidthPx = isMobile ? mobileCardWidth : cardWidthPx
  const layoutCardGapPx = isMobile ? MOBILE_LAYOUT.GAP_PX : cardGapPx
  const layoutCustomWidths = isMobile ? EMPTY_CUSTOM_WIDTHS : customWidths

  // Card width slider drives every card's default width directly (px-absolute).
  // Cards that the user has freely resized (`customWidths[id]`) keep their own
  // width — the slider intentionally doesn't override per-card customizations.
  const skylineCards = useMemo<SkylineCard[]>(
    () =>
      filteredItems.map((it) => {
        const w = layoutCustomWidths[it.bookmarkId] ?? layoutCardWidthPx
        // Same deterministic height the render layer (CardsLayer) uses, so the
        // scroll-range / contentBounds never diverge from the actual cards for
        // thumbnail-less placeholder cards.
        return { id: it.bookmarkId, width: w, height: itemSkylineHeight(it, w) }
      }),
    [filteredItems, layoutCardWidthPx, layoutCustomWidths],
  )

  const layout = useMemo(
    () =>
      computeSkylineLayout({
        cards: skylineCards,
        containerWidth: effectiveLayoutWidth,
        gap: layoutCardGapPx,
      }),
    [skylineCards, effectiveLayoutWidth, layoutCardGapPx],
  )

  const horizontalOffset = layoutSidePaddingPx

  // Actual content bounds — tracks the furthest right/bottom any card reaches,
  // using masonry positions (freePos not used in masonry mode) plus overrides
  // that Task 12 will populate during drag-to-reorder.
  // BOARD_TOP_PAD_PX gives the board breathing room at the top so the first
  // row does not collide with the toolbar pill; added to the total so scroll
  // range still reaches cards after the shift in the cards wrapper transform.
  // The bottom room is capped to a fraction of the visible board height (see
  // module-level constants) so the deepest card stops around screen-center
  // rather than scrolling off the top into empty background. (user request, s92)
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
    const bottomOverscroll = Math.round(viewport.h * BOTTOM_OVERSCROLL_FRACTION)
    return {
      width: Math.max(layout.totalWidth, maxRight + SCROLL_OVERFLOW_MARGIN_X),
      height: Math.max(
        layout.totalHeight + BOARD_TOP_PAD_PX,
        maxBottom + BOARD_TOP_PAD_PX + bottomOverscroll,
      ),
    }
  }, [filteredItems, layout.positions, layout.totalWidth, layout.totalHeight, viewport.h])

  // Layout for the share preview + payload. Under a tag filter the board keeps
  // every card mounted (`filteredItems` = all, for the CRT shutdown animation)
  // and shows only the matched set reflowed into a compact masonry via
  // CardsLayer. `lightboxNavItems` is exactly that visible matched set. We
  // recompute its compact layout with the SAME params as the board's full
  // `layout` (containerWidth / gap / width) so the mirror matches what the board
  // actually displays. No tag filter → identical to `layout`, so reuse it
  // without recomputing.
  const shareLayout = useMemo(() => {
    if (matchedBookmarkIds == null) return layout
    const cards: SkylineCard[] = lightboxNavItems.map((it) => {
      const w = layoutCustomWidths[it.bookmarkId] ?? layoutCardWidthPx
      return { id: it.bookmarkId, width: w, height: itemSkylineHeight(it, w) }
    })
    return computeSkylineLayout({ cards, containerWidth: effectiveLayoutWidth, gap: layoutCardGapPx })
  }, [matchedBookmarkIds, layout, lightboxNavItems, layoutCustomWidths, layoutCardWidthPx, effectiveLayoutWidth, layoutCardGapPx])

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

  // Mobile native scroll → mirror scrollTop into viewport.y (one-way). This is
  // the SOLE writer of viewport.y on mobile, so background / culling / deep-links
  // follow with no two-way sync. Desktop keeps its own wheel / reorder writers.
  const handleMobileScroll = useCallback((): void => {
    const el = mobileScrollRef.current
    if (!el) return
    const y = el.scrollTop
    viewportRef.current = { ...viewportRef.current, y }
    setViewport((v) => (v.y === y ? v : { ...v, y }))
  }, [])

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
    // Mobile owns scrolling natively: drive the real scroll container so the
    // background / culling follow via handleMobileScroll. Animating viewport.y
    // (the desktop path below) would NOT move the native scroll position.
    if (isMobile) {
      mobileScrollRef.current?.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' })
      return
    }
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
  }, [viewport.y, contentBounds.height, markScrollActive, isMobile])

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
      fetcher: createCompositeFetcher(defaultFetcher),
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
    // Silence any sound-on board card (Tier 3): its unmuted player would keep
    // playing AUDIO behind the lightbox (the source card is only hidden, and a
    // hidden <video>/<iframe> still plays), which reads as "a video card blips
    // with sound as the lightbox opens". Clearing it stops that at the source.
    setAudioActiveId(null)
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
  // Rename dialog target for the context menu's RENAME row. Null = closed.
  const [tagRenameTarget, setTagRenameTarget] = useState<{ tagId: string } | null>(null)

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
        setTagAddedTick((t) => t + 1)
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
      const target = existing ?? (await addTag(db, {
        name: trimmed, color: '#28F100', order: tags.length,
        // Flag tags born during the tutorial (e.g. the demo "sample") so they're
        // swept with the demo cards. Reused existing tags are never flagged.
        ...(onboardingActiveRef.current ? { onboardingDemo: true } : {}),
      }))
      await addTagToBookmark(db, bookmarkId, target.id)
      setTagAddedTick((t) => t + 1)
      await reloadTags()
      await reload()
    },
    [tags, reload, reloadTags],
  )

  // Onboarding tag scene: tag the newest card (highest orderIndex = the card the
  // user just saved) with a sample tag, so the tutorial demonstrates tagging
  // without the user fiddling with the popover. handleTagCreate bumps
  // tagAddedTick, which advances the scene.
  const applySampleTag = useCallback(async (): Promise<void> => {
    if (items.length === 0) return
    const newest = items.reduce((a, b) => ((b.orderIndex ?? 0) > (a.orderIndex ?? 0) ? b : a))
    await handleTagCreate(newest.bookmarkId, 'sample')
  }, [items, handleTagCreate])

  // Onboarding tag scene "camera": pushes the whole board view in toward the
  // just-added card so it lands centered + enlarged, then the typed-tag demo
  // plays on it. Transforms a wrapper around InteractionLayer only (the
  // onboarding overlay is a sibling, so its fixed positioning is unaffected;
  // canvasWrap's overflow:hidden clips the zoom to the board area).
  const cameraRef = useRef<HTMLDivElement>(null)
  // The board rim (.canvas) hosts the grab-wiggle CSS vars so the pan layers
  // (descendants via cameraWrap) inherit them.
  const canvasElRef = useRef<HTMLDivElement>(null)
  // The outer board frame (.outerFrame) — captured whole for the SHARE image so
  // the shared picture IS the real framed board (edge + wordmark + collage), not
  // a flat redraw. `capturing` briefly stamps data-capturing on it so CSS can
  // hide the operation chrome (menus / SHARING bar / language switcher) just for
  // the shot; the AllMarks wordmark and the frame stay.
  const boardFrameRef = useRef<HTMLDivElement>(null)
  const [capturing, setCapturing] = useState<boolean>(false)

  // Empty-board grab-wiggle: writes --grab-x/--grab-y on the .canvas rim; the
  // layer transforms below add them scaled per depth. Reset on theme change so
  // an offset never sticks across a switch.
  const grabWiggle = useGrabWiggle({ containerRef: canvasElRef, resetKey: themeId })
  // Grab feedback flag. While the DEFAULT-theme board is being grab-wiggled,
  // set data-grabbing on <html> so the chrome + wordmark glitch (CSS) and the
  // chrome scramble loop (JS, useChromeScramble) react in lockstep, and the
  // waveform meter resonates (grabbing prop below). Gated to default + grabbing,
  // so the flag is NEVER present on other themes or at rest → the reaction is
  // default-only and the board is byte-identical at rest. Reduced-motion is
  // inherently safe: grab-wiggle never sets `grabbing` under reduced-motion.
  const grabReacting = grabWiggle.grabbing && themeId === DEFAULT_THEME_ID
  useEffect(() => {
    const html = document.documentElement
    if (grabReacting) html.setAttribute('data-grabbing', '')
    else html.removeAttribute('data-grabbing')
    return (): void => {
      html.removeAttribute('data-grabbing')
    }
  }, [grabReacting])
  // Parchment/background layer only parallaxes on paper-atelier; other themes
  // keep the bg static under the grab (flat wiggle = cards only).
  const bgGrabWeight = themeId === 'paper-atelier' ? GRAB_LAYER_WEIGHTS.parchment : 0

  const zoomCameraToOnboardingCard = useCallback((): void => {
    const cam = cameraRef.current
    const card = document.querySelector('[data-onboarding-target="card"]')
    if (!cam || !card) return
    const cr = card.getBoundingClientRect()
    const mr = cam.getBoundingClientRect()
    const cx = cr.left + cr.width / 2
    const cy = cr.top + cr.height / 2
    gsap.to(cam, {
      transformOrigin: `${cx - mr.left}px ${cy - mr.top}px`,
      scale: 1.7,
      x: window.innerWidth / 2 - cx,
      y: window.innerHeight / 2 - cy,
      duration: 1.1,
      ease: 'power3.inOut',
    })
  }, [])
  const resetOnboardingCamera = useCallback((): void => {
    const cam = cameraRef.current
    if (!cam) return
    gsap.to(cam, {
      scale: 1, x: 0, y: 0, duration: 0.7, ease: 'power3.inOut',
      onComplete: () => { gsap.set(cam, { clearProps: 'all' }) },
    })
  }, [])

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

  // Nav scope = lightboxNavItems (what's currently visible on canvas, i.e.
  // the matched set when a tag filter is active). Items not on the board
  // (archived, filtered-out, tagged-out) are not nav-reachable from the
  // lightbox — that matches the user's mental model: "I'm browsing what I see".
  const lightboxIndex = useMemo(
    () => lightboxNavItems.findIndex((it) => it.bookmarkId === lightboxItemId),
    [lightboxNavItems, lightboxItemId],
  )
  const lightboxItem = lightboxIndex >= 0 ? lightboxNavItems[lightboxIndex] : null

  const handleLightboxNav = useCallback((dir: -1 | 1): void => {
    if (lightboxNavItems.length === 0 || lightboxIndex < 0) return
    const next = ((lightboxIndex + dir) % lightboxNavItems.length + lightboxNavItems.length) % lightboxNavItems.length
    const nextId = lightboxNavItems[next]?.bookmarkId ?? null
    setLightboxItemId(nextId)
    if (nextId) revalidateOnNav(nextId)
    // Source id and origin rect are NOT touched here — close always
    // returns to the originally clicked card regardless of how many
    // chevron-navs the user performed in between (B-#11).
  }, [lightboxNavItems, lightboxIndex, revalidateOnNav])

  const handleLightboxJump = useCallback((index: number): void => {
    if (index < 0 || index >= lightboxNavItems.length) return
    const nextId = lightboxNavItems[index]?.bookmarkId ?? null
    setLightboxItemId(nextId)
    if (nextId) revalidateOnIntent(nextId)
    // Source id / origin rect preserved — see handleLightboxNav (B-#11).
  }, [lightboxNavItems, revalidateOnIntent])

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

  const handleThemeChange = useCallback((next: ThemeId): void => {
    setThemeId(next)
    void (async (): Promise<void> => {
      const db = await initDB()
      const cfg = await loadBoardConfig(db)
      await saveBoardConfig(db, { ...cfg, themeId: next })
    })()
  }, [])

  // Effective (defaults + overrides) customization for the active theme, or null
  // for fixed 'work' themes. Drives the board's edge/board/pattern CSS vars.
  const resolvedCustom = useMemo(
    () => resolveThemeCustomization(themeId, themeCustomizations[themeId]),
    [themeId, themeCustomizations],
  )

  // The pattern backdrop (dots/grid) is client-state-dependent — its theme comes
  // from IDB — but the board is statically prerendered with the DEFAULT theme
  // (patternType 'none'). If the patternLayer rendered during SSR/first hydration
  // it would bake data-pattern="none" into the HTML, and React 18 does NOT patch
  // hydration *attribute* mismatches — so a saved non-default pattern theme (e.g.
  // grid) stays stuck on 'none' and draws nothing. Gate the layer on a post-mount
  // flag so the server + first client render both omit it (no mismatch), then it
  // mounts fresh with the correct pattern. (data-theme-id themes like Paper are
  // unaffected — the pre-paint inline script sets that attribute before hydration.)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])

  // Merge a partial customization into the active theme + persist. An empty
  // patch from the panel's "reset" clears the theme back to its defaults.
  const handleCustomizeTheme = useCallback(
    (patch: ThemeCustomization | null): void => {
      setThemeCustomizations((prev) => {
        const next: Partial<Record<ThemeId, ThemeCustomization>> = { ...prev }
        if (patch === null) {
          delete next[themeId]
        } else {
          next[themeId] = { ...prev[themeId], ...patch }
        }
        void (async (): Promise<void> => {
          const db = await initDB()
          const cfg = await loadBoardConfig(db)
          await saveBoardConfig(db, { ...cfg, themeCustomizations: next })
        })()
        return next
      })
    },
    [themeId],
  )

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

  const handleToggleBgTypo = useCallback((): void => {
    setBgTypoUserToggled(true)
    setBgTypoEnabled((prev) => {
      const next = !prev
      void (async (): Promise<void> => {
        const db = await initDB()
        const cfg = await loadBoardConfig(db)
        await saveBoardConfig(db, { ...cfg, bgTypoEnabled: next })
      })()
      return next
    })
  }, [])

  const handleToggleRoundedCorners = useCallback((): void => {
    setRoundedCorners((prev) => {
      const next = !prev
      void (async (): Promise<void> => {
        const db = await initDB()
        const cfg = await loadBoardConfig(db)
        await saveBoardConfig(db, { ...cfg, roundedCorners: next })
      })()
      return next
    })
  }, [])

  // During arrange, the header TITLE toggle drives ONLY the ephemeral collage
  // title (React state, discarded on exit — spec §10). It must NOT persist to
  // BoardConfig/IDB: toggling the collage title off to get a title-free shot
  // leaves the board's own background wordmark exactly as it was after DONE.
  const handleToggleShareTitle = useCallback((): void => {
    setShareTitle((c) => (c ? { ...c, enabled: !c.enabled } : c))
  }, [])

  const handleOpenBookmarkletModal = useCallback((): void => {
    setBookmarkletModalOpen(true)
  }, [])
  const handleCloseBookmarkletModal = useCallback((): void => {
    setBookmarkletModalOpen(false)
  }, [])

  // ---- Selective share ------------------------------------------------
  // Payload/preview items resolve against `items` (live bookmarks, orderIndex
  // DESC) so the shared set is board-ordered, not click-ordered. Ids selected
  // under a different tag filter still resolve here (selection survives
  // filter switches; spec §2).
  const shareSelectedItems = useMemo(
    () => (shareSelectedIds == null ? null : selectedInBoardOrder(items, shareSelectedIds)),
    [items, shareSelectedIds],
  )

  // Compact skyline of ONLY the selected cards — the same reflow the receiver
  // reconstructs, so the preview shows what they will actually see (spec §3).
  const selectionLayout = useMemo(() => {
    if (shareSelectedItems == null) return null
    const cards: SkylineCard[] = shareSelectedItems.map((it) => {
      const w = customWidths[it.bookmarkId] ?? cardWidthPx
      return { id: it.bookmarkId, width: w, height: itemSkylineHeight(it, w) }
    })
    return computeSkylineLayout({ cards, containerWidth: effectiveLayoutWidth, gap: cardGapPx })
  }, [shareSelectedItems, customWidths, cardWidthPx, effectiveLayoutWidth, cardGapPx])

  const selectionContentHeight =
    selectionLayout == null ? 0 : selectionLayout.totalHeight + BOARD_TOP_PAD_PX

  const handleEnterSelectMode = useCallback((): void => {
    setActiveDrawer(null)
    setShareSelectedIds(null)
    setSelectedIds(new Set())
    setTagMode(false)
    setSharePhase('select')
  }, [])

  // TAG MODE mirrors SHARE select but tags the selection instead of collaging
  // it. Same selectedIds + handleSelectToggle; the two modes are mutually
  // exclusive (entering one clears the other).
  const handleEnterTagMode = useCallback((): void => {
    setActiveDrawer(null)
    setSharePhase(null)
    setSelectedIds(new Set())
    setTagMode(true)
  }, [])

  const handleExitTagMode = useCallback((): void => {
    setTagMode(false)
    setTagDraft(null)
    setSelectedIds(new Set())
  }, [])

  useEffect((): (() => void) | undefined => {
    if (!tagMode) return undefined
    const onKey = (e: KeyboardEvent): void => {
      // While the "+ NEW TAG" input is open, Esc is handled by the input (it
      // just closes the draft) — don't also drop out of TAG MODE.
      if (e.key === 'Escape' && !tagDraft) handleExitTagMode()
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [tagMode, tagDraft, handleExitTagMode])

  // Tap an empty area to leave TAG MODE: the frame edge outside the board, or a
  // gap between cards. "Empty" = a tap (no drag/pan) that isn't on a card, the
  // tag panel, or an interactive control. Capture-phase so it sees the gesture
  // even though InteractionLayer captures the pointer for its own pan/wiggle.
  useEffect((): (() => void) | undefined => {
    if (!tagMode) return undefined
    let sx = 0
    let sy = 0
    let tracking = false
    const TAP_SLOP_PX = 6
    const onDown = (e: globalThis.PointerEvent): void => {
      if (e.button !== 0) { tracking = false; return }
      sx = e.clientX
      sy = e.clientY
      tracking = true
    }
    const onUp = (e: globalThis.PointerEvent): void => {
      if (!tracking) return
      tracking = false
      // Mid tag-create: let the input's own blur commit/cancel; don't exit.
      if (tagDraft) return
      // A drag/pan (board scroll, card→tag drag) is not a dismiss tap.
      if (Math.hypot(e.clientX - sx, e.clientY - sy) > TAP_SLOP_PX) return
      const t = e.target as Element | null
      if (!t || typeof t.closest !== 'function') return
      if (t.closest('[data-bookmark-id]')) return                                   // a card (selection toggle)
      if (t.closest('[data-tag-panel]')) return                                     // the tag panel
      if (t.closest('button, a, input, textarea, select, [role="button"]')) return // chrome control
      handleExitTagMode()
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('pointerup', onUp, true)
    return (): void => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('pointerup', onUp, true)
    }
  }, [tagMode, tagDraft, handleExitTagMode])

  // Latest items, read inside the drop handler without stale-closing over one
  // render's snapshot (a drop can land many renders after entering TAG MODE).
  const itemsRef = useRef(items)
  itemsRef.current = items

  // Assign an existing tag to a set of cards, additively (union with each
  // card's current tags; already-tagged cards are skipped). Fired by a drop on
  // a [data-tag-id] row. Selection persists — continuous multi-tagging.
  const assignTagToCards = useCallback(
    (tagId: string, cardIds: readonly string[]): void => {
      const writes = computeTagAssignments(itemsRef.current, cardIds, tagId)
      for (const w of writes) void persistTags(w.bookmarkId, w.nextTags)
    },
    [persistTags],
  )

  // TAG MODE drop router — CardsLayer emits this on a genuine drop. A real tag
  // id assigns immediately; "__new__" opens the inline create input (Phase 3)
  // for the dropped cards.
  const handleTagDrop = useCallback(
    (targetKey: string, cardIds: readonly string[]): void => {
      if (cardIds.length === 0) return
      if (targetKey === '__new__') {
        setTagDraft({ cardIds: [...cardIds] })
        return
      }
      assignTagToCards(targetKey, cardIds)
    },
    [assignTagToCards],
  )

  // Mobile TAG MODE: tap a tag in the bottom bar → assign it to the whole
  // current selection (additive; no-op when nothing is selected). Selection
  // persists so the user can keep tapping tags for continuous multi-tagging.
  const handleAssignTagToSelection = useCallback((tagId: string): void => {
    if (selectedIds.size === 0) return
    assignTagToCards(tagId, [...selectedIds])
  }, [assignTagToCards, selectedIds])

  // "+ NEW TAG" clicked (no drag) — create a tag for the current selection.
  const handleStartNewTag = useCallback((): void => {
    setTagDraft({ cardIds: [...selectedIds] })
  }, [selectedIds])

  const handleCommitNewTag = useCallback(
    (name: string): void => {
      const trimmed = name.trim()
      const draft = tagDraft
      setTagDraft(null)
      if (!trimmed) return
      void (async (): Promise<void> => {
        const colors = ['#7c5cfc', '#e066d7', '#4ecdc4', '#f5a623', '#ff6b6b']
        const color = colors[tags.length % colors.length]
        const created = await createTag({ name: trimmed, color, order: tags.length })
        if (draft && draft.cardIds.length > 0) assignTagToCards(created.id, draft.cardIds)
      })()
    },
    [tagDraft, tags.length, createTag, assignTagToCards],
  )

  const handleCancelNewTag = useCallback((): void => setTagDraft(null), [])

  const handleSelectToggle = useCallback(
    (bookmarkId: string): void => {
      const r = toggleSelection(selectedIds, bookmarkId)
      if (r.capped) return
      setSelectedIds(r.ids)
    },
    [selectedIds],
  )

  const handleSelectAll = useCallback((): void => {
    const r = addAllVisible(selectedIds, lightboxNavItems.map((it) => it.bookmarkId))
    setSelectedIds(r.ids)
  }, [selectedIds, lightboxNavItems])

  // 連続ジェスチャ開始: 変更前スナップショットを捕捉。移動は掴んだ id を最前面にした
  // 状態を「変更前」とする（選択タップの自動前面化は履歴に含めない）。ピンチは id なし。
  const handleCollageGestureStart = useCallback((reorderId?: string): void => {
    const s = collageStateRef.current
    pendingHistoryRef.current = {
      positions: s.positions,
      order: reorderId ? bringToFront(s.order, reorderId) : s.order,
      rotations: s.rotations,
    }
  }, [])

  // 連続ジェスチャ終了: 実際に変わっていれば pending を undo に積む・redo を空に。
  const handleCollageGestureEnd = useCallback((): void => {
    const before = pendingHistoryRef.current
    pendingHistoryRef.current = null
    if (!before) return
    if (snapshotsEqual(before, collageStateRef.current)) return
    setCollageUndoStack((s) => pushSnapshot(s, before, MAX_COLLAGE_HISTORY))
    setCollageRedoStack([])
  }, [])

  // 離散操作（前面/背面/削除）用: 実行の直前に現在状態を undo に積む・redo を空に。
  const pushHistoryBeforeDiscreteEdit = useCallback((): void => {
    setCollageUndoStack((s) => pushSnapshot(s, collageStateRef.current, MAX_COLLAGE_HISTORY))
    setCollageRedoStack([])
  }, [])

  const applyCollageSnapshot = useCallback((snap: CollageSnapshot): void => {
    setCollagePositions(snap.positions)
    setCollageOrder([...snap.order])
    setCollageRotations({ ...snap.rotations })
    setSelectedCollageId((cur) => (cur && !snap.order.includes(cur) ? null : cur))
  }, [])

  const handleCollageUndo = useCallback((): void => {
    const stack = collageUndoRef.current
    if (stack.length === 0) return
    const prev = stack[stack.length - 1]
    if (!prev) return
    setCollageRedoStack((r) => pushSnapshot(r, collageStateRef.current, MAX_COLLAGE_HISTORY))
    setCollageUndoStack(stack.slice(0, -1))
    applyCollageSnapshot(prev)
  }, [applyCollageSnapshot])

  const handleCollageRedo = useCallback((): void => {
    const stack = collageRedoRef.current
    if (stack.length === 0) return
    const next = stack[stack.length - 1]
    if (!next) return
    setCollageUndoStack((u) => pushSnapshot(u, collageStateRef.current, MAX_COLLAGE_HISTORY))
    setCollageRedoStack(stack.slice(0, -1))
    applyCollageSnapshot(next)
  }, [applyCollageSnapshot])

  const handleDeleteSelectedCollage = useCallback((): void => {
    const id = selectedCollageId
    if (!id) return
    pushHistoryBeforeDiscreteEdit()
    const s = collageStateRef.current
    const r = removeFromCollage(s.positions, s.order, s.rotations, id)
    setCollagePositions(r.positions)
    setCollageOrder(r.order)
    setCollageRotations(r.rotations)
    setSelectedCollageId(null)
    setRemoveToast(true)
  }, [selectedCollageId, pushHistoryBeforeDiscreteEdit])

  const handleBringSelectedToFront = useCallback((): void => {
    const id = selectedCollageId
    if (!id) return
    pushHistoryBeforeDiscreteEdit()
    setCollageOrder((o) => bringToFront(o, id))
  }, [selectedCollageId, pushHistoryBeforeDiscreteEdit])

  const handleSendSelectedToBack = useCallback((): void => {
    const id = selectedCollageId
    if (!id) return
    pushHistoryBeforeDiscreteEdit()
    setCollageOrder((o) => sendToBack(o, id))
  }, [selectedCollageId, pushHistoryBeforeDiscreteEdit])

  const handleDoubleTapFit = useCallback((): void => {
    setStageTransform(IDENTITY_STAGE_TRANSFORM)
  }, [])

  // Leave SHARE mode entirely from EITHER stage (CANCEL / Esc / DONE), discarding
  // the working selection and the temporary collage layout — nothing is persisted.
  const handleExitShareMode = useCallback((): void => {
    setSharePhase(null)
    setSelectedIds(new Set())
    setCollagePositions({})
    setCollageOrder([])
    setCollageRotations({})
    setShareTitle(null)
    setCapturedImageUrl(null)
    setHostedShareUrl(null)
    setShareCreateState('idle')
    setCaptureAttempts(null)
    setShareErrorMessage(null)
    setMobileBandRect(null)
    setSelectedCollageId(null)
    setStageTransform(IDENTITY_STAGE_TRANSFORM)
    setCollageUndoStack([])
    setCollageRedoStack([])
    setRemoveToast(false)
    pendingHistoryRef.current = null
  }, [])

  // The rect the initial collage layout is fit into (window coords): the .canvas
  // panel inset by the header row (top), SHARING bar (bottom), and a small side
  // margin — so cards START nicely inside the frame. After that the user can drag
  // them anywhere (incl. off the edge); the frame clip below crops the overflow.
  const arrangeSafeRect = useMemo((): CollageFitRect => {
    const m = CANVAS_MARGIN_PX
    return {
      x: m + ARRANGE_SAFE_INSET.SIDE_PX,
      y: m + ARRANGE_SAFE_INSET.TOP_PX,
      width: Math.max(0, viewport.w - 2 * ARRANGE_SAFE_INSET.SIDE_PX),
      height: Math.max(0, viewport.h - ARRANGE_SAFE_INSET.TOP_PX - ARRANGE_SAFE_INSET.BOTTOM_PX),
    }
  }, [viewport.w, viewport.h])

  // Stage 1 → 2: 選んだカードを「盤面パネルに収まる中で最大サイズ」に自動配置してアレンジ開始。
  // fit rect は「見える盤面パネル（.canvas＝ウィンドウから CANVAS_MARGIN_PX 内側）」を基準に
  // 取り、ヘッダー行（上）と SHARING バー（下）を避ける。fitSelectionToScreen が skyline パック
  // ＋収まる最大倍率の二分探索＋中央寄せを行うので、何枚選んでも盤面からはみ出さない（N-40）。
  // 倍率は座標に焼き込まれ、移動/リサイズ/回転（画面px基準）はそのまま動く。WYSIWYG 座標は使わない。
  const handleEnterArrange = useCallback((): void => {
    if (selectedIds.size === 0) return
    const chosen = lightboxNavItems.filter((it) => selectedIds.has(it.bookmarkId))
    // Fit INTO the visible board panel (.canvas), using the shared safe rect.
    const rect = arrangeSafeRect
    const cards = chosen.map((it) => {
      const w = customWidths[it.bookmarkId] ?? cardWidthPx
      return { id: it.bookmarkId, width: w, height: itemSkylineHeight(it, w) }
    })
    // justified rows で盤面パネル rect を端まで充填する（縦横比のみ使用・盤面既定サイズを
    // 上限に頭打ち・隙間はカード高さに比例）。少数カードは中央寄せ、多数は端までびっしり。
    setCollagePositions(fitSelectionToScreen(cards, rect))
    setCollageOrder(chosen.map((it) => it.bookmarkId))
    setCollageRotations({}) // re-entry (RESELECT→ARRANGE) reseeds a clean flat layout, no tilt
    setShareTitle(defaultShareTitleConfig(bgTypoEnabled, viewport.w, viewport.h))
    setSharePhase('arrange')
  }, [selectedIds, lightboxNavItems, customWidths, cardWidthPx, arrangeSafeRect, viewport.w, viewport.h, bgTypoEnabled])

  // Esc leaves SHARE mode from either stage (= CANCEL / DONE). Only bound while
  // a share stage is active.
  useEffect((): (() => void) | undefined => {
    if (sharePhase === null) return undefined
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') handleExitShareMode()
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [sharePhase, handleExitShareMode])

  // Task 8: one-shot panel-edge glow on arrange entry — shows the capture
  // rectangle (the existing .canvas edge), then fades within ~900ms so it is
  // gone before the user takes their screenshot. Cosmetic only; no layout
  // change (see BoardRoot.module.css .canvasArrangeGuide).
  const [arrangeGuidePulse, setArrangeGuidePulse] = useState(false)
  useEffect((): (() => void) | undefined => {
    if (sharePhase !== 'arrange') {
      setArrangeGuidePulse(false)
      return undefined
    }
    setArrangeGuidePulse(true)
    const t = window.setTimeout((): void => setArrangeGuidePulse(false), 900)
    return (): void => window.clearTimeout(t)
  }, [sharePhase])

  // Local preview pan for a selection share — clamped to the selection's own
  // content height; the bg board's viewport is not touched.
  const handleSelectionPanY = useCallback(
    (dy: number): void => {
      const maxY = Math.max(0, selectionContentHeight - viewport.h)
      setSelectionScrollY((y) => Math.min(Math.max(y + dy, 0), maxY))
    },
    [selectionContentHeight, viewport.h],
  )
  // ---- /Selective share -----------------------------------------------

  // Phase 3 share rebuild (Task 15): build the v2 share payload from the
  // current board view (= filtered visible items + relevant tag dict +
  // active tags filter). Called lazily by SenderShareModal on open.
  const buildShareData = useCallback((): ShareDataV2 => {
    // Selection share sends the confirmed manual set (board order); normal
    // share keeps the existing visible-set behaviour.
    const source = shareSelectedItems ?? lightboxNavItems
    return buildShareDataFromBoard({
      // lightboxNavItems = the cards actually visible on the board (matched set
      // under a tag filter, else the full filtered set). Sharing this — not the
      // mounted-but-hidden `filteredItems` — keeps the payload to the narrowed
      // view the user sees.
      items: source.map((it) => ({
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
      // A manual selection is independent of the tag filter — no filter strip
      // on the receiver (spec §3).
      filter: shareSelectedItems == null && activeFilter.kind === 'tags'
        ? { mode: activeFilter.mode, tagIds: activeFilter.tagIds }
        : null,
      now: Date.now(),
      // Carry the live theme + its resolved customization so the shared board +
      // OG image reproduce what the sender sees. resolvedCustom is null for fixed
      // 'work' themes (Paper) — then themeId alone reproduces the look.
      themeId,
      custom: resolvedCustom ?? undefined,
      // Global masonry gap the sender sees. Per-card widths ride on each
      // card's `cw`; this is the only remaining global layout input the
      // receiver needs to reproduce the same arrangement.
      gap: cardGapPx,
      // Sender's default card width so the receiver reconstructs board state.
      defaultWidth: cardWidthPx,
    })
  }, [shareSelectedItems, lightboxNavItems, tags, activeFilter, customWidths, cardWidthPx, cardGapPx, themeId, resolvedCustom])

  // COPY LINK (arrange stage): build the /s payload from the ARRANGE selection
  // (selectedIds — NOT shareSelectedItems, which is null here) in board order,
  // filter:null. Generates NO image (thumb-less createShare); the /s OG falls
  // back to the default card server-side.
  // Build the /s payload from the ARRANGE selection (selectedIds) in board order,
  // filter:null. Shared by COPY LINK (thumb-less) and CREATE LINK (with image).
  const buildArrangeShare = useCallback((): ShareDataV2 => {
    const chosen = selectedInBoardOrder(items, selectedIds)
    return buildShareDataFromBoard({
      items: chosen.map((it) => ({
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
      filter: null,
      now: Date.now(),
      themeId,
      custom: resolvedCustom ?? undefined,
      gap: cardGapPx,
      defaultWidth: cardWidthPx,
    })
  }, [items, selectedIds, customWidths, cardWidthPx, tags, themeId, resolvedCustom, cardGapPx])

  const shareOrigin = (): string => (typeof window !== 'undefined' ? window.location.origin : 'https://allmarks.app')

  // 撮影の地色 (JPEG はアルファを持てないので、透明部分＝枠外の余白や contain の
  // レターボックスをこの色で塗る)。外枠 (.outerFrame) の地色に合わせる: pattern テーマは
  // resolvedCustom.edgeColor、それ以外は外枠の computed 背景 (= --bg-outer) を実測。
  const deriveCaptureBoardColor = useCallback((): string => {
    if (resolvedCustom?.edgeColor) return resolvedCustom.edgeColor
    const el = boardFrameRef.current
    if (el && typeof getComputedStyle === 'function') {
      const bg = getComputedStyle(el).backgroundColor
      if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') return bg
    }
    return '#0a0a0c'
  }, [resolvedCustom])

  // CREATE (③作る): 「本物のボードそのまま」を自動撮影する。
  //   1. data-capturing を外枠に立てて、操作用クローム (右上メニュー / SHARING バー /
  //      言語切替 / MOTION・フィルタ) だけ撮影の一瞬だけ隠す。左上 AllMarks ワードマークと
  //      枠 (.canvas の縁) は残す (ユーザー合意: 枠とロゴは入れる、メニューは入れない)。
  //   2. dom-to-image で外枠 (.outerFrame) をそのまま画像化 (枠・ロゴ・並べたカード・
  //      背景・タイトルまで WYSIWYG)。撮影時だけ clone のカード <img> を同一オリジン画像
  //      proxy (/api/img) 経由に差し替えクロスオリジン汚染を回避。fit=contain＋地色で
  //      レターボックスし、枠を切らずに 1200×630 に収める。
  //   3. その JPEG を thumb にして /s 共有を R2 上に作成 → /og キャッシュを温める。
  // 撮影が失敗しても thumb 無しで作成する (= 共有を絶対に壊さない。OG は既定カードに fallback)。
  const handleCreateHostedShare = useCallback(async (): Promise<void> => {
    if (selectedInBoardOrder(items, selectedIds).length === 0) return
    setShareCreateState('creating')
    let thumb: string | null = null
    const node = boardFrameRef.current
    if (node && typeof requestAnimationFrame === 'function') {
      setCapturing(true)
      // data-capturing の CSS (メニュー等を隠す) が確実に paint されてから撮る。
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
      try {
        thumb = await captureCollageShareImage(node, {
          origin: shareOrigin(),
          boardColor: deriveCaptureBoardColor(),
          fit: 'contain',
        })
      } finally {
        setCapturing(false)
      }
    }
    setCapturedImageUrl(thumb)
    const res = await createHostedShare({
      buildShare: buildArrangeShare,
      thumb: thumb ?? undefined,
      createShare,
      origin: shareOrigin(),
      warm: (u: string): void => { void fetch(u).catch((): void => {}) },
    })
    if (res.ok) {
      setHostedShareUrl(res.url)
      setShareCreateState('idle')
    } else {
      setShareCreateState('error')
    }
  }, [items, selectedIds, buildArrangeShare, deriveCaptureBoardColor])

  // スマホ: 選択カードの2本指ピンチ開始 — 進行中のカード移動を止め、base をスナップショット。
  const handleSelectedPinchStart = useCallback((): void => {
    collageArbiter.cancelActive()
    handleCollageGestureStart()
    if (selectedCollageId === null) return
    pinchBaseRef.current = {
      positions: collagePositions,
      rotation: collageRotations[selectedCollageId] ?? 0,
      id: selectedCollageId,
    }
  }, [handleCollageGestureStart, collageArbiter, selectedCollageId, collagePositions, collageRotations])

  // スマホ: 選択カードの2本指ピンチ中 — base から絶対計算で拡縮（中心軸）+回転。
  const handleSelectedPinch = useCallback(
    (change: { readonly factor: number; readonly deltaDeg: number }): void => {
      const base = pinchBaseRef.current
      if (!base) return
      setCollagePositions(scaleElementFromCenter(base.positions, base.id, change.factor, effectiveLayoutWidth))
      setCollageRotations((r) => ({ ...r, [base.id]: base.rotation + change.deltaDeg }))
    },
    [effectiveLayoutWidth],
  )

  // スマホ ARRANGE のズーム・スライダー: 選択カード中心（無選択は画面中心）にボードをズーム。
  // stageTransform だけを触る（撮影は state 由来＝画像に無影響）。関数型 setState で
  // prev から pivot を計算＝stale closure を避ける。
  const handleZoomSliderChange = useCallback(
    (nextScale: number): void => {
      const box = boardFrameRef.current?.getBoundingClientRect()
      const vw = box?.width ?? viewport.w
      const vh = box?.height ?? viewport.h
      setStageTransform((prev) => {
        const pos = selectedCollageId ? collagePositions[selectedCollageId] : undefined
        let pivot: StagePoint
        if (pos) {
          const cx = pos.x + pos.w / 2
          const cy = pos.y + pos.h / 2
          pivot = { x: cx * prev.scale + prev.tx, y: cy * prev.scale + prev.ty }
        } else {
          pivot = { x: vw / 2, y: vh / 2 }
        }
        return zoomStageToScale(prev, nextScale, pivot, vw, vh)
      })
    },
    [selectedCollageId, collagePositions, viewport.w, viewport.h],
  )

  // モバイル ARRANGE ドックの -/+ ボタン: handleZoomSliderChange は絶対スケールを受け取り
  // 内部で [1,6] にクランプ済み（重複クランプ不要）。fit は既存 handleDoubleTapFit を再利用。
  const BOARD_ZOOM_STEP = 1
  const handleBoardZoomIn = useCallback((): void => {
    handleZoomSliderChange(stageTransform.scale + BOARD_ZOOM_STEP)
  }, [handleZoomSliderChange, stageTransform.scale])
  const handleBoardZoomOut = useCallback((): void => {
    handleZoomSliderChange(stageTransform.scale - BOARD_ZOOM_STEP)
  }, [handleZoomSliderChange, stageTransform.scale])

  // スマホの ARRANGE（tap 1）: 選択カードを帯に自動配置して編集段に入る（撮影はまだしない・N-58）。
  const handleMobileEnterArrange = useCallback((): void => {
    if (selectedIds.size === 0) return
    const frame = boardFrameRef.current
    const box = frame?.getBoundingClientRect()
    const frameW = box?.width ?? viewport.w
    const frameH = box?.height ?? viewport.h

    // 帯 = 画面に内接する中央の 縦4:5 矩形（モバイル主役）。fit も overlay もこれで縦になる。
    const band = mobileCollagePortraitBandRect(frameW, frameH)

    const chosen = lightboxNavItems.filter((it) => selectedIds.has(it.bookmarkId))
    const cards = chosen.map((it) => {
      const w = customWidths[it.bookmarkId] ?? cardWidthPx
      return { id: it.bookmarkId, width: w, height: itemSkylineHeight(it, w) }
    })
    setCollagePositions(fitSelectionToScreen(cards, band))
    setCollageOrder(chosen.map((it) => it.bookmarkId))
    setCollageRotations({})
    setShareTitle(null)
    setCapturedImageUrl(null)
    setHostedShareUrl(null)
    setShareCreateState('idle')
    setCaptureAttempts(null)
    setShareErrorMessage(null)
    setMobileBandRect(band)
    setSelectedCollageId(null)
    setStageTransform(IDENTITY_STAGE_TRANSFORM)
    setCollageUndoStack([])
    setCollageRedoStack([])
    setRemoveToast(false)
    pendingHistoryRef.current = null
    setSharePhase('arrange')
  }, [selectedIds, lightboxNavItems, customWidths, cardWidthPx, viewport.w, viewport.h])

  // スマホの CREATE（tap 2）: いま編集されている配置のまま撮影してリンクを作る（再配置しない・N-58）。
  // canvasCards は現在の state（collageOrder=重なり順 / collagePositions=位置サイズ /
  // collageRotations=回転）から組む。撮影経路そのもの（renderCollageCanvasToJpeg・scale・
  // 2フレーム待ち・パンくず）は N-56 のまま 1 行も変えない。
  const handleMobileCaptureAndCreate = useCallback(async (): Promise<void> => {
    const frame = boardFrameRef.current
    const band = mobileBandRect
    if (!band) return
    setCapturedImageUrl(null)
    setHostedShareUrl(null)
    setCaptureAttempts(null)
    setShareErrorMessage(null)
    setShareCreateState('creating')

    // renderer 用カード列 — 重なり順（collageOrder）で並べ、各 id の位置(collagePositions)・
    // 回転(collageRotations)・カードメタ(lightboxNavItems) を突き合わせる。位置の無い id は除外。
    const itemById = new Map(lightboxNavItems.map((it) => [it.bookmarkId, it]))
    // 重なり順（collageOrder）で並べて焼く（盤面の並び順ではない）。z 順＝collageOrder が正。
    const canvasCards: CollageCanvasCard[] = collageOrder
      .map((id): CollageCanvasCard | null => {
        const it = itemById.get(id)
        const rect = collagePositions[id]
        if (!it || !rect) return null
        return {
          id,
          title: it.title,
          thumbnailUrl: it.thumbnail ?? null,
          url: it.url,
          rect,
          rotation: collageRotations[id] ?? 0,
        }
      })
      .filter((c): c is CollageCanvasCard => c !== null)

    // canvas レンダラーは出力空間(1200x630)の単一 roundedCornersPx を取る。盤面の半径は
    // 幅依存(cardCornerRadiusPx)なので、帯内カード幅の中央値を代表値にして出力空間へスケール。
    // flat は arrange-stage CollageCanvas の paper prop(themeMeta.decorations===true)と同値。
    const bandToOutScale = band.width > 0 ? SHARE_PORTRAIT_ASPECT.WIDTH / band.width : 1
    const bandWidths = canvasCards
      .map((c) => c.rect.w)
      .filter((w): w is number => typeof w === 'number' && w > 0)
      .sort((a, b) => a - b)
    const medianBandW = bandWidths.length ? (bandWidths[Math.floor(bandWidths.length / 2)] ?? 0) : 0
    const roundedCornersPx =
      parseFloat(
        cardCornerRadiusPx({ width: medianBandW, roundedCorners, flat: themeMeta.decorations === true }),
      ) * bandToOutScale

    let thumb: string | null = null
    if (frame && typeof requestAnimationFrame === 'function') {
      setCapturing(true)
      // data-capturing の CSS が確実に paint されてから撮る（N-56 と同じ 2 フレーム待ち）。
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
      try {
        const scale = mobileCaptureScale(band.width)
        const captureW = frame.offsetWidth || 1200
        const captureH = frame.offsetHeight || 630
        let sourceMP = 0
        frame.querySelectorAll('img').forEach((im): void => {
          sourceMP += (im.naturalWidth * im.naturalHeight) / 1_000_000
        })
        writeCaptureBreadcrumb({
          ts: Date.now(),
          cardCount: canvasCards.length,
          frameW: band.width,
          frameH: band.height,
          scale,
          canvasW: Math.round(captureW * scale),
          canvasH: Math.round(captureH * scale),
          sourceMP,
        })
        thumb = await renderCollageCanvasToJpeg({
          cards: canvasCards,
          band,
          width: SHARE_PORTRAIT_ASPECT.WIDTH,
          height: SHARE_PORTRAIT_ASPECT.HEIGHT,
          bgColor: deriveCaptureBoardColor(),
          roundedCornersPx,
          toProxyUrl: (s: string): string => rewriteToProxy(s, shareOrigin()),
          targetBytes: 180 * 1024,
          startQuality: 0.82,
          minQuality: 0.5,
        })
        clearCaptureBreadcrumb()
        setCaptureAttempts(
          thumb ? null : [{ scale: 1, timeoutMs: 0, elapsedMs: 0, stage: 'render', message: 'canvas render returned null' }],
        )
      } finally {
        setCapturing(false)
      }
    } else {
      setCaptureAttempts([{ scale: 1, timeoutMs: 0, elapsedMs: 0, stage: 'no-frame', message: null }])
    }
    setCapturedImageUrl(thumb)

    // リンクカード用: 縦画像を 1.91:1 のボード色キャンバス中央にレターボックス併産。
    // ホストする OG は 1.91:1 のまま（og:image:width/height=1200/630 と一致）。失敗時は
    // 画像なしでもリンクは作る（メタが嘘にならない・ネイティブ共有は縦画像で成立）。
    const linkCardThumb = thumb
      ? await letterboxImageToAspect(thumb, SHARE_OG_ASPECT.WIDTH, SHARE_OG_ASPECT.HEIGHT, deriveCaptureBoardColor())
      : null

    const res = await createHostedShare({
      buildShare: buildArrangeShare,
      thumb: linkCardThumb ?? undefined,
      createShare,
      origin: shareOrigin(),
      warm: (u: string): void => { void fetch(u).catch((): void => {}) },
    })
    if (res.ok) {
      setHostedShareUrl(res.url)
      setShareCreateState('idle')
    } else {
      setShareErrorMessage(res.message)
      setShareCreateState('error')
    }
  }, [
    mobileBandRect, collageOrder, collagePositions, collageRotations, lightboxNavItems,
    roundedCorners, themeMeta, buildArrangeShare, deriveCaptureBoardColor,
  ])

  // Ready-state COPY LINK copies the already-hosted url.
  const handleShareCopyLink = useCallback(async (): Promise<boolean> => {
    if (!hostedShareUrl) return false
    try {
      await navigator.clipboard.writeText(hostedShareUrl)
      return true
    } catch {
      return false
    }
  }, [hostedShareUrl])

  const handlePostToX = useCallback((): void => {
    if (!hostedShareUrl) return
    window.open(buildTweetIntentUrl(hostedShareUrl), '_blank', 'noopener,noreferrer')
  }, [hostedShareUrl])

  // Ready-state SAVE IMAGE: hand the auto-captured 1080×1350 portrait JPEG to the user as a
  // download so they can post it natively on X (native image posts dwarf link cards).
  // The allmarks.app URL is baked into the image so it travels with the post.
  const handleSaveShareImage = useCallback((): void => {
    if (!capturedImageUrl || typeof document === 'undefined') return
    const id = hostedShareUrl?.split('/').pop() || 'board'
    const a = document.createElement('a')
    a.href = capturedImageUrl
    a.download = shareImageFilename(id, capturedImageUrl)
    document.body.appendChild(a)
    a.click()
    a.remove()
  }, [capturedImageUrl, hostedShareUrl])

  // RESELECT: back to card selection, discarding the created link + captured image.
  const handleShareReselect = useCallback((): void => {
    setCapturedImageUrl(null)
    setHostedShareUrl(null)
    setShareCreateState('idle')
    setSelectedCollageId(null)
    setStageTransform(IDENTITY_STAGE_TRANSFORM)
    setSharePhase('select')
  }, [])

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

  // Paste-to-save: listen for clipboard paste events on the board canvas and
  // save valid URLs directly to IDB. Mirrors the same reload + entrance
  // highlight path used by the bookmarklet BroadcastChannel above. Shared with
  // the mobile save paths (smart + button, input sheet, Android share
  // receiver) below via handleUrlSaved.
  const handleUrlSaved = useCallback(async (bookmarkId: string): Promise<void> => {
    await reload()
    setNewlyAddedIds((prev) => {
      const next = new Set(prev)
      next.add(bookmarkId)
      return next
    })
    setTimeout(() => {
      setNewlyAddedIds((prev) => {
        const next = new Set(prev)
        next.delete(bookmarkId)
        return next
      })
    }, 800)
    // Broadcast to other surfaces (PiP companion, second board tab) so they
    // reload and show the new card. The local `subscribeBookmarkSaved` listener
    // above will also fire from this broadcast — a benign second reload that is
    // acceptable (no entrance highlight on other tabs is intentional).
    postBookmarkSaved({ bookmarkId })
  }, [reload])

  const { feedback: pasteFeedback } = useUrlPasteSave({
    onSaved: handleUrlSaved,
    flagOnboardingRef: onboardingActiveRef,
  })

  // Mobile save entries (smart + button, input sheet, Android share receiver)
  // share the same handleUrlSaved core as desktop paste but through a second
  // useSaveUrl instance — desktop paste (useUrlPasteSave above) is untouched.
  // isTouchDevice gates the + button / sheet mount below (pointer: coarse
  // only, so a mouse desktop never renders them). The two feedback sources
  // never fire together in practice, so mergedSaveFeedback below just prefers
  // whichever is non-null.
  const isTouchDevice = useIsTouchDevice()
  const { feedback: mobileSaveFeedback, saveUrl: mobileSaveUrl } = useSaveUrl({ onSaved: handleUrlSaved })
  const [saveSheetOpen, setSaveSheetOpen] = useState(false)
  const mergedSaveFeedback = pasteFeedback.kind ? pasteFeedback : mobileSaveFeedback

  // Android Web Share Target: manifest points share intents at
  // /board?shared=true&(url|text)=…. Read the query once on mount (static export
  // → client-side), save via the shared core, then strip the query so a reload
  // never re-saves. iOS never reaches here (it can't register a share target).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('shared') !== 'true') return
    const raw = params.get('url') || params.get('text') || ''
    const url = normalizeToUrl(raw)
    // Always strip the shared params regardless of validity (avoid re-fire).
    window.history.replaceState(null, '', window.location.pathname)
    if (url) void mobileSaveUrl(url)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // BroadcastChannel: reload (no entrance highlight) when an existing bookmark
  // changes — e.g., a tag added from the extension's quick-tag strip or the
  // PiP companion. Also reload the tag master so a tag *created* in PiP shows
  // up in the board's tag list immediately.
  useEffect(() => {
    const unsub = subscribeBookmarkUpdated(() => {
      void reload()
      void reloadTags()
    })
    return (): void => unsub()
  }, [reload, reloadTags])

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

  // Per-tag bookmark count for the FilterPill dropdown rows. Counts the
  // active (= non-deleted) set only, so the number matches what the user
  // sees on the board when they pick that tag filter. Tags with 0 are kept
  // (shown muted) so empty tags are visible for cleanup.
  const tagCounts = useMemo<Readonly<Record<string, number>>>(() => {
    const m: Record<string, number> = {}
    for (const tag of tags) m[tag.id] = 0
    for (const it of items) {
      for (const tagId of it.tags) {
        if (tagId in m) m[tagId] += 1
      }
    }
    return m
  }, [items, tags])

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
    ? (lightboxNavItems.length > 1 ? lightboxIndex / (lightboxNavItems.length - 1) : 0)
    : (meterScrollableHeight > 0 ? viewport.y / meterScrollableHeight : 0)

  // Parent-side scrub translator: ScrollMeter sends a 0..1 fraction at most
  // once per frame; we translate to mode-appropriate action (= scroll-to-y
  // in board mode, jump-to-card in lightbox mode).
  const handleMeterScrub = useCallback((fraction: number): void => {
    if (isLightboxMode) {
      const lastIdx = Math.max(0, lightboxNavItems.length - 1)
      const idx = Math.max(0, Math.min(lastIdx, Math.round(fraction * lastIdx)))
      handleLightboxJump(idx)
    } else {
      const y = Math.max(0, fraction * meterScrollableHeight)
      handleScrollMeterJump(y)
    }
  }, [isLightboxMode, lightboxNavItems.length, handleLightboxJump, handleScrollMeterJump, meterScrollableHeight])

  // Single FilterPill element reused by BOTH the desktop top band and the mobile
  // bottom nav. Only one is ever mounted (the band renders when !isMobile, the
  // nav when isMobile), so its testids stay unique.
  const filterPillEl = (
    <FilterPill
      value={activeFilter}
      onChange={handleFilterChange}
      tags={tags}
      counts={sidebarCounts}
      tagCounts={tagCounts}
      tagsMatchCount={isTagsFilter(activeFilter) ? matchedBookmarkIds?.size ?? 0 : undefined}
      onTagContextMenu={openTagContextMenu}
      activeContextTagId={tagContextMenu?.tagId ?? tagDeleteConfirm?.tagId ?? null}
      onReorder={(orderedIds): void => { void reorderTags(orderedIds) }}
      editingTagId={tagRenameTarget?.tagId ?? null}
      onRenameSubmit={(tagId, name): void => {
        void renameTag(tagId, name)
        setTagRenameTarget(null)
      }}
      onRenameCancel={(): void => setTagRenameTarget(null)}
      tagOrderMode={tagOrderMode}
      onCycleTagOrder={(): void => { void setTagOrderMode(nextTagOrderMode(tagOrderMode)) }}
    />
  )

  return (
    <>
    <div
      ref={boardFrameRef}
      className={styles.outerFrame}
      data-capturing={capturing ? 'true' : undefined}
      style={resolvedCustom ? ({
        '--edge-color': resolvedCustom.edgeColor,
        '--bg-typo-color': resolvedCustom.titleColor,
        // On a LIGHT edge, flip the whole edge-band chrome to dark ink (legible
        // instead of vanishing white-on-white with a stray dark outline + glow).
        ...(isLightColor(resolvedCustom.edgeColor) ? LIGHT_EDGE_CHROME : {}),
      } as CSSProperties) : undefined}
    >
      {/* Outer-frame chrome — AllMarks wordmark (top-left dark margin) linking
          to the marketing home, so users have a way back to the LP from the
          board. Session 130: restored as wordmark-only (the bottom marketing
          link strip waits for a footer redesign). Fades with the chrome while
          the Lightbox is open, mirroring frameTopChrome. */}
      <BoardChrome hidden={!!lightboxItemId} />
      {/* Paper-atelier decorative chrome (Plan 2 §4.7) — MK-1 plate (bottom-left)
          + wax "A" seal & decorative "+" stamp (bottom-right). pointer-events:none
          siblings of BoardChrome, gated on the theme opting into decorations, and
          faded with the chrome while the Lightbox is open (mirrors BoardChrome). */}
      {themeMeta.decorations === true && (
        <>
          <PaperFramePlate hidden={!!lightboxItemId} />
          <PaperWaxSeal hidden={!!lightboxItemId} />
        </>
      )}
      {/* The always-on bottom-left bookmarklet pill was removed (session 114).
          The no-extension install path now lives in SETTINGS ("SAVE WITHOUT
          EXTENSION" → BookmarkletInstallModal) and the empty-state welcome,
          and will become the onboarding flow's primary step. */}
      {/* MOTION switch + active-filter readout live in the outer frame's TOP
          BAND (the empty margin above the canvas), right edge aligned to the
          canvas action row's SHARE button. Placing them here — OUTSIDE the
          canvas, which clips its own overflow — lets them sit ABOVE the
          TUNE/POP OUT/SHARE row without ever shifting it (user requirement).
          Fades out with the rest of the chrome while the Lightbox is open. */}
      {!isMobile && (
        <div
          className={lightboxItemId ? `${styles.frameTopChrome} ${styles.frameTopChromeHidden}` : styles.frameTopChrome}
          aria-hidden={lightboxItemId ? 'true' : undefined}
        >
          <MotionToggle enabled={motionEnabled} onToggle={handleToggleMotion} />
          {filterPillEl}
        </div>
      )}
      {/* Mobile: the FILTER pill lives in the top-RIGHT header (opposite the
          AllMarks wordmark top-left). Tap opens its menu downward; it closes on
          outside-tap / Esc only (no hover auto-close on touch). */}
      {/* Mobile: invisible tap band across the top header. Tapping the empty gap
          between the wordmark and FILTER scrolls the board to the top (the iOS
          status-bar-tap idiom). z below the wordmark/FILTER (120) so those keep
          their own tap; above the cards, which start below BOARD_TOP_PAD. */}
      {isMobile && !lightboxItemId && (
        <button
          type="button"
          className={styles.mobileScrollTopZone}
          aria-label="Scroll to top"
          onClick={(): void => handleScrollMeterJump(0)}
        />
      )}
      {isMobile && !lightboxItemId && (
        <div className={styles.mobileTopFilter}>
          {filterPillEl}
        </div>
      )}
      {/* Bottom frame band — mirror of frameTopChrome. Hosts the ScrollMeter in
          the outer frame's BOTTOM margin (OUTSIDE the dark canvas) so the meter's
          scrub hit-area never overlaps card operations near the board floor
          (user goal s170). Outside the canvas — which clips its own overflow and
          carries the pan/zoom transforms — so no fixed/transform containing-block
          pitfall. The band is z 400 (see CSS) so the unified meter still renders
          above the Lightbox (z 300) exactly as it did in-canvas; it stays visible
          during the Lightbox and only hides for onboarding / arrange via
          shouldShowScrollMeter. */}
      <div className={styles.frameBottomChrome}>
        {!isMobile && shouldShowScrollMeter(showOnboarding, sharePhase) && (
          <ScrollMeter
            mode={meterMode}
            n1={meterN1}
            n2={meterN2}
            total={filteredItems.length}
            swellFraction={meterSwellFraction}
            onScrub={handleMeterScrub}
            variant={themeMeta.scrollMeterVariant}
            grabbing={grabReacting}
          />
        )}
      </div>
      {/* Mobile bottom navigation (A2b) — hosts TAG / THEME / SHARE / CORNERS /
          MORE since the desktop top chrome is hidden on mobile (MOTION moved into
          MORE, FILTER into the top-right header — N-49). Hidden while the Lightbox
          is open (the lightbox surface owns the screen), during onboarding (the
          tutorial drives its own chrome), during TAG MODE (the mobile tag bar
          takes the floor in its place — s182), and during any SHARE stage (the
          select bar / result sheet own the bottom). */}
      {isMobile && !lightboxItemId && !showOnboarding && !tagMode && sharePhase === null && (
        <BoardMobileNav
          onTag={handleEnterTagMode}
          tagActive={tagMode}
          onThemes={() => setActiveDrawer(activeDrawer === 'themes' ? null : 'themes')}
          themesActive={activeDrawer === 'themes'}
          onShare={handleEnterSelectMode}
          cornersRounded={roundedCorners}
          onToggleCorners={handleToggleRoundedCorners}
          onSettings={() => setActiveDrawer(activeDrawer === 'settings' ? null : 'settings')}
          settingsActive={activeDrawer === 'settings'}
        />
      )}
      {/* Mobile/tablet smart "+" save entry (s183) — touch-only via
          useIsTouchDevice (pointer: coarse), independent of the width-based
          isMobile layout gate above so tablets in landscape still get it.
          Hidden under the same conditions as the bottom nav, plus during any
          SHARE stage (select or arrange — the floating + would collide with
          the select bar / collage canvas). */}
      {isTouchDevice && !lightboxItemId && !showOnboarding && !tagMode && sharePhase === null && (
        <MobileSaveButton
          themeId={themeId}
          onSave={(url): void => { void mobileSaveUrl(url) }}
          onNeedInput={(): void => setSaveSheetOpen(true)}
        />
      )}
      {isTouchDevice && (
        <MobileSaveSheet
          open={saveSheetOpen}
          onClose={(): void => setSaveSheetOpen(false)}
          onSave={mobileSaveUrl}
          themeId={themeId}
        />
      )}
      {/* Inner dark canvas — destefanis-style stage. The whole pan/cards/
          live inside, so cursor pan never escapes the rounded frame.
          Phase 1A: canvas is now a grid (auto / 1fr) — TopHeader at top,
          canvasWrap holds the existing absolute-layered scroll/cards stage. */}
      <div
        ref={canvasElRef}
        className={arrangeGuidePulse ? `${styles.canvas} ${styles.canvasArrangeGuide}` : styles.canvas}
        // The edge-band chrome override above cascades into here; reset it to the
        // default light-on-dark chrome so the header + card chrome (which sit on
        // the dark board, not the edge) keep their normal ink.
        // (NB: a *light* BOARD colour would also make the header faint, but the
        // header components don't yet share one chrome token — see follow-up.)
        style={resolvedCustom && isLightColor(resolvedCustom.edgeColor) ? DARK_CHROME_RESET : undefined}
      >
        <TopHeader
          hidden={!!lightboxItemId}
          actions={
            <>
              <ChromeLedToggle
                label="TITLE"
                on={sharePhase === 'arrange' ? !!shareTitle?.enabled : bgTypoEnabled}
                onToggle={sharePhase === 'arrange' ? handleToggleShareTitle : handleToggleBgTypo}
                wrapTestId="bgtypo-toggle-wrap"
                ledTestId="bgtypo-led"
                btnTestId="bgtypo-toggle"
              />
              <TuneTrigger
                widthPx={cardWidthPx}
                gapPx={cardGapPx}
                onChangeWidth={handleCardWidthChange}
                onChangeGap={handleCardGapChange}
                onReset={handleResetWidthGap}
                onApplyPreset={onApplyPreset}
                roundedCorners={roundedCorners}
                onToggleCorners={handleToggleRoundedCorners}
                containerWidth={effectiveLayoutWidth}
              />
              <ExtensionEntry
                quickTagEnabled={quickTagEnabled}
                onQuickTagToggle={handleQuickTagToggle}
                onOpenBookmarkletModal={handleOpenBookmarkletModal}
                onReplayIntro={() => { void startOnboardingReplay() }}
                isOpen={activeDrawer === 'settings'}
                onOpenChange={(open) => setActiveDrawer(open ? 'settings' : null)}
                themeId={themeId}
                onOpenThemeModal={() => setActiveDrawer('themes')}
                customWidthCount={customWidthCount}
                onResetCardSizes={() => { void handleResetCardSizes() }}
                onSortNewestFirst={() => { void handleSortNewestFirst() }}
                motion={isMobile ? { enabled: motionEnabled, onToggle: handleToggleMotion } : undefined}
              />
              <TagButton
                onClick={(): void => {
                  // Onboarding 'manage' scene → show the REAL /triage in
                  // onboarding mode (demo-card auto-demo + the swipe pan), then
                  // resume the tutorial at the next scene on return. MANAGE is
                  // only clickable during that scene (the overlay blocks it
                  // otherwise), so gating on showOnboarding is enough.
                  if (onboardingActiveRef.current) {
                    try { sessionStorage.setItem('allmarks-onboarding-resume', 'share') } catch { /* private mode */ }
                    router.push('/triage?onboarding=1')
                    return
                  }
                  // Session 81: entry picker removed. TriagePage now auto-
                  // selects mode based on the untagged backlog (= empty
                  // backlog → 'all' so the user can review existing tags,
                  // otherwise → 'untagged'). A single-tag board filter
                  // still passes through with its mode so the user keeps
                  // their cohort context.
                  // s170: MANAGE TAGS now opens the in-page TAG MODE (drag-drop
                  // tagging) instead of navigating to the Triage swipe page.
                  // Triage stays reachable via the onboarding branch above and
                  // is otherwise dormant (removed in a later phase).
                  handleEnterTagMode()
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
                onClick={(): void => { if (sharePhase === null) handleEnterSelectMode() }}
                data-testid="share-pill"
                data-onboarding-target="share"
              />
              {activeFilter.kind === 'archive' && deletedItems.length > 0 && (
                <ChromeButton
                  label="EMPTY TRASH"
                  onClick={handleEmptyTrashRequest}
                  data-testid="empty-trash-button"
                  data-variant="danger"
                />
              )}
            </>
          }
        />
        <div ref={canvasRef} className={styles.canvasWrap} data-lightbox-clone-host data-onboarding-target="paste-zone">
          <div ref={cameraRef} className={styles.cameraWrap}>
          <InteractionLayer
            direction={themeMeta.direction}
            onScroll={handleScroll}
            spaceHeld={spaceHeld}
            wiggle={grabWiggle}
            isMobile={isMobile}
          >
            {/* grid-paper: VIEWPORT-anchored grid (screen-fixed, NOT in a pan
                wrapper) so the pattern always centres on the viewport — the
                left/right edges cut symmetrically regardless of content width.
                It parallaxes vertically via background-position-y (= the grid's
                drift) so it floats behind the cards instead of sitting glued. */}
            {hydrated && themeMeta.kind === 'pattern' && resolvedCustom && (
              <div
                aria-hidden="true"
                className={themeStyles.patternLayer}
                data-pattern={resolvedCustom.patternType}
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: BOARD_Z_INDEX.THEME_BG,
                  pointerEvents: 'none',
                  backgroundPosition: `calc(50% + var(--grab-x, 0px) * ${GRAB_LAYER_WEIGHTS.pattern}) calc(${-gridBgPanY}px + var(--grab-y, 0px) * ${GRAB_LAYER_WEIGHTS.pattern})`,
                  '--board-color': resolvedCustom.boardColor,
                  '--pattern-color': resolvedCustom.patternColor,
                  '--pattern-size': `${resolvedCustom.patternSize}px`,
                  // Same clamp the share's SVG applies, so the board and the link
                  // it produces can't disagree on line weight.
                  '--pattern-stroke': `${effectivePatternStroke(resolvedCustom.patternStroke, resolvedCustom.patternSize)}px`,
                  '--pattern-dot-r': `${effectivePatternStroke(resolvedCustom.patternStroke, resolvedCustom.patternSize)}px`,
                } as CSSProperties}
              />
            )}
            {/* Background — full canvas coverage, follows scroll. Paper-atelier
                lags the vertical pan by paperParallaxY (0.4x) for a depth
                read; every other theme keeps the exact 1:1 pan
                (paperParallaxY is 0 unless paper + motion + not reduced). */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transform: `translate3d(calc(${-viewport.x}px + var(--grab-x, 0px) * ${bgGrabWeight}), calc(${-viewport.y + paperParallaxY}px + var(--grab-y, 0px) * ${bgGrabWeight}), 0)`,
                willChange: 'transform',
                pointerEvents: 'none',
              }}
            >
              <ThemeLayer
                themeId={themeId}
                totalWidth={contentWidth}
                totalHeight={contentHeight}
              />
            </div>
            {/* Paper-atelier MIDDLE parallax layer: faint stains/flourishes
                scattered across the content, panned at 0.30x (vs cards 1x and
                the fixed 0x backdrop) for a strong depth read. Behind the
                wordmark and cards (DOM order). Paper-only; decorParallaxY is 0
                off-paper. Items scatter across only the band the slow pan ever
                exposes (decorScatterHeight) for uniform on-screen density. */}
            {themeId === 'paper-atelier' && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: contentWidth,
                  height: contentHeight,
                  transform: `translate3d(calc(${-viewport.x}px + var(--grab-x, 0px) * ${GRAB_LAYER_WEIGHTS.decor}), calc(${-viewport.y + decorParallaxY}px + var(--grab-y, 0px) * ${GRAB_LAYER_WEIGHTS.decor}), 0)`,
                  willChange: 'transform',
                  pointerEvents: 'none',
                }}
              >
                <BoardDecorLayer scatterHeight={viewport.h + DECOR_PARALLAX_FACTOR * Math.max(0, contentHeight - viewport.h)} />
              </div>
            )}
            {/* Hero background typography — viewport-bound (does NOT live
                inside the pan-transform wrappers above), so the headline
                stays centred on screen while cards travel over it. The
                cards-wrapper that follows in DOM order establishes its
                own stacking context via translate3d, and since the
                typography host carries no explicit z-index, DOM order
                alone keeps the cards above the typography. */}
            {/* Rendered while `bgTypoMount` is non-null — being mounted == being
                visible, period (the previous animation-driven visibility was
                what made it flicker/vanish). On a user toggle ON it mounts fresh
                and plays the boot-up; on a user toggle OFF it stays mounted with
                closing=true to play the CRT shutdown, then the parent timer
                unmounts it. Never animation-driven visibility.
                Gated off during 'arrange': the editable ShareTitleElement inside
                CollageCanvas takes over as the title in that stage, so this
                original background wordmark must NOT also render — otherwise
                the two titles would stack. */}
            {/* Mobile: the giant centered wordmark is far wider than a 390px
                viewport (only a couple of stray strokes would show), so it's not
                rendered on mobile — a pure breakpoint gate, not animation-driven
                visibility. */}
            {!isMobile && sharePhase !== 'arrange' && bgTypoMount && (
              <BoardBackgroundTypography
                themeId={themeId}
                activeFilter={activeFilter}
                tags={tags}
                variant={bgTypoVariant}
                playEntry={bgTypoUserToggled && !bgTypoMount.closing}
                closing={bgTypoMount.closing}
              />
            )}
            {/* Cards — full-canvas-width with destefanis half-gap padding.
                Vertical transform adds BOARD_TOP_PAD_PX so the first row gets
                breathing room below the canvas top edge / toolbar pill.
                Hidden during SHARE stage 2 ('arrange') so the collage sits on an
                EMPTY themed canvas (spec §1.3): the theme background layers above
                stay, but the live grid must NOT show through the collage gaps.
                Stage 'select' and null keep the grid rendering normally. */}
            {sharePhase !== 'arrange' && (() => {
              const cards = (
                <CardsLayer
                  themeId={themeId}
                  items={filteredItems}
                  viewport={viewport}
                  viewportWidth={effectiveLayoutWidth}
                  cardGapPx={layoutCardGapPx}
                  roundedCorners={roundedCorners}
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
                  defaultCardWidth={layoutCardWidthPx}
                  customWidths={layoutCustomWidths}
                  onCardResize={handleCardResize}
                  onCardResizeEnd={handleCardResizeEnd}
                  onCardResetSize={handleCardResetSize}
                  sourceCardId={lightboxSourceItemId}
                  onPanY={handlePanY}
                  isMobile={isMobile}
                  motionEnabled={motionEnabled}
                  matchedBookmarkIds={matchedBookmarkIds}
                  allTags={tags}
                  onTagToggle={handleTagToggle}
                  onTagCreate={handleTagCreate}
                  onTagFilterToggle={(tagId, sourceBookmarkId): void => {
                    if (sourceBookmarkId) lastClickedSourceRef.current = sourceBookmarkId
                    handleFilterChange(toggleTagInFilter(activeFilter, tagId))
                  }}
                  onTagContextMenu={openTagContextMenu}
                  activeContextTagId={tagContextMenu?.tagId ?? tagDeleteConfirm?.tagId ?? null}
                  isScrolling={isScrolling}
                  entryAnimCycle={entryAnimCycle}
                  forceTagButtonVisible={forceCardTagVisible}
                  selectionMode={
                    tagMode
                      ? { selectedIds, onToggle: handleSelectToggle, onTagDrop: handleTagDrop }
                      : sharePhase === 'select'
                        ? { selectedIds, onToggle: handleSelectToggle }
                        : null
                  }
                />
              )
              // Mobile: a REAL overflow-scroll container owns touch scrolling
              // (native inertia / rubber-band, zero JS). Its scrollTop mirrors
              // into viewport.y via handleMobileScroll. A tall spacer supplies the
              // scroll range; the inner wrapper offsets cards by the top pad +
              // h-offset to match the desktop transform's origin. Desktop is the
              // exact same node as before (untouched).
              return isMobile ? (
                <div
                  ref={mobileScrollRef}
                  onScroll={handleMobileScroll}
                  className={styles.mobileScrollContainer}
                >
                  <div style={{ position: 'relative', width: '100%', height: `${contentBounds.height}px` }}>
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        transform: `translate(${horizontalOffset}px, ${BOARD_TOP_PAD_PX}px)`,
                        pointerEvents: 'none',
                      }}
                    >
                      {cards}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    transform: `translate3d(calc(${horizontalOffset - viewport.x}px + var(--grab-x, 0px) * ${GRAB_LAYER_WEIGHTS.cards}), calc(${BOARD_TOP_PAD_PX - viewport.y}px + var(--grab-y, 0px) * ${GRAB_LAYER_WEIGHTS.cards}), 0)`,
                    willChange: 'transform',
                    pointerEvents: 'none',
                  }}
                >
                  {cards}
                </div>
              )
            })()}
          </InteractionLayer>
          </div>
          {!loading && showOnboarding && onboardingDbRef.current && (
            <OnboardingController
              db={onboardingDbRef.current}
              motionEnabled={motionEnabled}
              appUrl={typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL ?? 'https://allmarks.app')}
              onComplete={() => { setShowOnboarding(false); setOnboardingInitialScene(undefined); resetOnboardingCamera(); void reload(); void reloadTags() }}
              initialScene={onboardingInitialScene}
              onRequestMotionOff={() => setMotionEnabled(false)}
              onTagSceneActive={setForceCardTagVisible}
              onSettingsBeatActive={(active: boolean) => setActiveDrawer(active ? 'settings' : null)}
              tagAddedSignal={tagAddedTick}
              onApplySampleTag={() => { void applySampleTag() }}
              onZoomToCard={zoomCameraToOnboardingCard}
              onZoomReset={resetOnboardingCamera}
              onShareSceneActive={(active): void => {
                // The old 'share' drawer was retired; the tutorial's share beat
                // now rides the two-stage SHARE mode. Entering = select stage,
                // leaving = full exit (discards the working selection/collage).
                if (active) handleEnterSelectMode()
                else handleExitShareMode()
              }}
              shareModalOpen={sharePhase !== null}
            />
          )}
          {!loading && !showOnboarding && showDataHomeCard && (
            <DataHomeCard onDismiss={onDataHomeGotIt} />
          )}
          {!loading && !showOnboarding && !showDataHomeCard && backupReminder && (
            <BackupReminder
              newCount={backupReminder.newCount}
              everBackedUp={backupReminder.everBackedUp}
              onExport={onReminderExport}
              onLater={onReminderLater}
            />
          )}
          {!loading && !showOnboarding && items.length === 0 && (
            <EmptyStateWelcome
              onOpenModal={handleOpenBookmarkletModal}
              onReplayIntro={() => { void startOnboardingReplay() }}
            />
          )}
        </div>
        {/* ScrollMeter moved OUT of the canvas to the bottom frame band
            (frameBottomChrome, above) so its scrub hit-area never overlaps card
            operations near the board floor (s170). The single unified meter
            still swaps board/Lightbox content via its mode prop, unchanged. */}
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
          themeId={themeId}
          nav={lightboxItem ? {
            currentIndex: lightboxIndex,
            total: lightboxNavItems.length,
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
        appUrl={typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL ?? 'https://allmarks.app')}
      />
      <ThemeModal
        isOpen={activeDrawer === 'themes'}
        onClose={(): void => setActiveDrawer(null)}
        themeId={themeId}
        onThemeChange={handleThemeChange}
        customization={resolvedCustom}
        isDefaultCustomization={isDefaultCustomization(themeId, themeCustomizations[themeId])}
        onCustomize={handleCustomizeTheme}
      />
      {/* Old SHARE drawer retired: SHARE is now the two-stage select→arrange
          collage mode (sharePhase). The modal is kept mounted-but-closed
          (open=false → renders null) so its share-payload helpers survive for
          the phase-3 COPY LINK path; it is never opened in the phase-1 flow. */}
      <SenderShareModal
        open={false}
        onClose={(): void => {
          setActiveDrawer(null)
          setShareSelectedIds(null) // selection is one-shot — discard on close (spec §1)
        }}
        getShareData={buildShareData}
        themeId={themeId}
        custom={resolvedCustom}
        totalBoardCount={(shareSelectedItems ?? lightboxNavItems).length}
        scrollY={shareSelectedItems != null ? selectionScrollY : viewport.y}
        contentHeight={shareSelectedItems != null
          ? selectionContentHeight
          : matchedBookmarkIds == null
            ? contentBounds.height
            : shareLayout.totalHeight + BOARD_TOP_PAD_PX}
        viewportHeight={viewport.h}
        activeTagNames={shareSelectedItems != null || !isTagsFilter(activeFilter)
          ? []
          : activeFilter.tagIds.flatMap((id): string[] => {
              const tag = tags.find((t) => t.id === id)
              return tag ? [tag.name] : []
            })}
        onPanY={shareSelectedItems != null
          ? handleSelectionPanY
          : (dy: number): void => { handlePanY(dy) }}
        items={(shareSelectedItems ?? lightboxNavItems).map((it): MirrorItem => ({
          id: it.bookmarkId,
          url: it.url,
          title: it.title,
          thumbnailUrl: it.thumbnail ?? null,
        }))}
        positions={Object.entries(
          shareSelectedItems != null && selectionLayout != null
            ? selectionLayout.positions
            : shareLayout.positions,
        ).map(([id, p]): MirrorPosition => ({ id, x: p.x, y: p.y, w: p.w, h: p.h }))}
        bgViewportWidth={effectiveLayoutWidth}
        bgCanvasWidth={viewport.w}
        bgTypoEnabled={bgTypoEnabled}
        bgTypoText={deriveBoardBgTypoText(activeFilter, tags)}
        onSelectCards={activeFilter.kind === 'archive' ? null : handleEnterSelectMode}
        selectionActive={shareSelectedItems != null}
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
            onRename={(): void => {
              setTagRenameTarget({ tagId: targetTag.id })
              setTagContextMenu(null)
            }}
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
          quickTagEnabled={quickTagEnabled}
        />
      </PipPortal>
      <UndoToast input={toast} />
      <PasteSaveFeedback feedback={mergedSaveFeedback} themeId={themeId} />
      {tagMode && !isMobile && (
        <TagDropPanel
          tags={tags}
          tagCounts={tagCounts}
          selectedCount={selectedIds.size}
          onDone={handleExitTagMode}
          creating={tagDraft !== null}
          onStartNewTag={handleStartNewTag}
          onCommitNewTag={handleCommitNewTag}
          onCancelNewTag={handleCancelNewTag}
        />
      )}
      {tagMode && isMobile && (
        <BoardMobileTagBar
          tags={tags}
          tagCounts={tagCounts}
          selectedCount={selectedIds.size}
          onAssignTag={handleAssignTagToSelection}
          onDone={handleExitTagMode}
          creating={tagDraft !== null}
          onStartNewTag={handleStartNewTag}
          onCommitNewTag={handleCommitNewTag}
          onCancelNewTag={handleCancelNewTag}
        />
      )}
      {sharePhase === 'select' && !isMobile && (
        <ShareSelectBar
          count={selectedIds.size}
          onSelectAll={handleSelectAll}
          onShare={handleEnterArrange}
          onCancel={handleExitShareMode}
        />
      )}
      {/* Phones: ARRANGE places the selection into the capture band and enters
          the edit stage (N-58); a later CREATE in the arrange bar shoots it. */}
      {sharePhase === 'select' && isMobile && (
        <MobileShareSelectBar
          count={selectedIds.size}
          onSelectAll={handleSelectAll}
          onCreate={handleMobileEnterArrange}
          onCancel={handleExitShareMode}
        />
      )}
      {sharePhase === 'arrange' && (
        <>
          <MobileArrangeGestures
            enabled={isMobile}
            transform={stageTransform}
            onTransformChange={setStageTransform}
            selectedId={selectedCollageId}
            onSelectedPinchStart={handleSelectedPinchStart}
            onSelectedPinch={handleSelectedPinch}
            onSelectedPinchEnd={handleCollageGestureEnd}
            onDeselect={(): void => setSelectedCollageId(null)}
            onDoubleTapFit={handleDoubleTapFit}
          >
            <CollageCanvas
              items={lightboxNavItems.filter((it) => selectedIds.has(it.bookmarkId))}
              positions={collagePositions}
              order={collageOrder}
              onMove={(id, x, y): void => setCollagePositions((p) => moveElement(p, id, x, y))}
              onResize={(id, corner, w): void => setCollagePositions((p) => resizeElementFromCorner(p, id, corner, w))}
              onGrab={(id): void => setCollageOrder((o) => bringToFront(o, id))}
              rotations={collageRotations}
              onRotate={(id, deg): void => setCollageRotations((r) => ({ ...r, [id]: deg }))}
              maxCardWidth={effectiveLayoutWidth}
              displayMode={displayMode}
              paper={themeMeta.decorations === true}
              roundedCorners={roundedCorners}
              onEditGestureStart={isMobile ? handleCollageGestureStart : undefined}
              onEditGestureEnd={isMobile ? handleCollageGestureEnd : undefined}
              title={
                shareTitle
                  ? { config: shareTitle, defaultText: deriveBoardBgTypoText(activeFilter, tags), onChange: setShareTitle }
                  : undefined
              }
              pointerScale={isMobile ? stageTransform.scale : undefined}
              selectedId={isMobile ? selectedCollageId : undefined}
              onSelect={isMobile ? (id): void => setSelectedCollageId(id) : undefined}
              touchMode={isMobile}
              gestureArbiter={isMobile ? collageArbiter : undefined}
            />
            {isMobile && mobileBandRect && <MobileBandOverlay band={mobileBandRect} />}
          </MobileArrangeGestures>
          {/* Operation bar — hidden from the SHARE capture (data-no-capture) so it
              never appears baked into the shared image, but stays on screen. */}
          <div data-no-capture>
            {isMobile ? (
              <>
                {/* Single dock replaces the old top bar + bottom bar (mobile-arrange-ux-redesign).
                    Edit affordances (undo/redo/selection tools) are gated to the 'idle' state so
                    they can't fire during the ~1-2s capture window while
                    handleMobileCaptureAndCreate is shooting the collage — CREATE alone stays live
                    (shown disabled + CREATING…) so the user sees progress. */}
                {hostedShareUrl === null && shareCreateState !== 'error' && (
                  <MobileArrangeDock
                    canUndo={shareCreateState === 'idle' && collageUndoStack.length > 0}
                    canRedo={shareCreateState === 'idle' && collageRedoStack.length > 0}
                    onUndo={handleCollageUndo}
                    onRedo={handleCollageRedo}
                    onZoomOut={handleBoardZoomOut}
                    onZoomIn={handleBoardZoomIn}
                    onZoomFit={handleDoubleTapFit}
                    hasSelection={shareCreateState === 'idle' && selectedCollageId !== null}
                    onBringToFront={handleBringSelectedToFront}
                    onSendToBack={handleSendSelectedToBack}
                    onRemove={handleDeleteSelectedCollage}
                    onBack={handleShareReselect}
                    onCreate={(): void => { void handleMobileCaptureAndCreate() }}
                    creating={shareCreateState === 'creating'}
                  />
                )}
                {(hostedShareUrl !== null || shareCreateState === 'error') && (
                  <>
                    <div
                      className={styles.resultScrim}
                      style={{ zIndex: BOARD_Z_INDEX.SHARE_RESULT_SCRIM }}
                      data-no-capture
                      data-testid="mobile-share-scrim"
                    />
                    <MobileShareResult
                      imageUrl={capturedImageUrl}
                      shareUrl={hostedShareUrl}
                      createState={shareCreateState}
                      captureAttempts={captureAttempts}
                      errorMessage={shareErrorMessage}
                      onCopyLink={handleShareCopyLink}
                      onRetry={(): void => { void handleMobileCaptureAndCreate() }}
                      onDone={handleExitShareMode}
                    />
                  </>
                )}
              </>
            ) : (
              <ShareToast
                count={selectedIds.size}
                createState={shareCreateState}
                onCreate={(): void => { void handleCreateHostedShare() }}
                shareUrl={hostedShareUrl}
                onCopyLink={handleShareCopyLink}
                onPostToX={handlePostToX}
                onSaveImage={capturedImageUrl ? handleSaveShareImage : undefined}
                onReselect={handleShareReselect}
                onDone={handleExitShareMode}
              />
            )}
          </div>
          {/* Sibling of the isMobile ternary above (not nested inside it) so Task 5's
              desktop remove flow can also trigger this same portal toast — a body
              portal doesn't care where it's mounted in the tree. On desktop
              removeToast stays false until that wiring lands, so this renders
              nothing there today. */}
          {removeToast && (
            <MobileArrangeToast
              message={t('board.collageRemoveToast')}
              onUndo={(): void => {
                handleCollageUndo()
                setRemoveToast(false)
              }}
              onDismiss={(): void => setRemoveToast(false)}
            />
          )}
        </>
      )}
      {/* Language switcher — fixed bottom-right, self-anchors via position:fixed
          in CSS. Hidden on mobile: it would collide with the bottom nav and show
          through the Lightbox. Language will live in the MORE panel on mobile
          (follow-up); the LP keeps its own switcher. */}
      {!isMobile && <div data-no-capture><LanguageSwitcher /></div>}
    </div>
    {/* Sibling of .outerFrame (the SHARE capture subtree), not a descendant —
        ShareCreatingIndicator itself portals to document.body, but keeping the
        JSX call site outside the capture root too avoids any future doubt. */}
    <ShareCreatingIndicator active={shareCreateState === 'creating'} />
    {captureCrash && (
      <CaptureCrashNotice
        breadcrumb={captureCrash}
        onDismiss={(): void => setCaptureCrash(null)}
      />
    )}
    </>
  )
}
