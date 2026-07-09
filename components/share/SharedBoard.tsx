'use client'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react'
import { useRouter } from 'next/navigation'
import { fetchShare } from '@/lib/share/api-client'
import { sanitizeShareDataV2 } from '@/lib/share/validate-v2'
import { extractShareIdFromPathname } from '@/lib/share/extract-share-id'
import type { ShareDataV2 } from '@/lib/share/types-v2'
import { initDB, addBookmarkBatch, getAllBookmarks } from '@/lib/storage/indexeddb'
import { orderForImport } from '@/lib/share/receiver-import-order'
import { shareCardToBoardItem } from '@/lib/share/share-card-to-board-item'
import { computeSkylineLayout, type SkylineCard, type SkylineResult } from '@/lib/board/skyline-layout'
import { BOARD_SLIDERS, BOARD_TOP_PAD_PX, BOARD_INNER, BOARD_Z_INDEX, MOBILE_LAYOUT } from '@/lib/board/constants'
import { useIsMobile } from '@/lib/board/use-is-mobile'
import { DEFAULT_THEME_ID, getThemeMeta } from '@/lib/board/theme-registry'
import { resolveThemeCustomization, patternSvgDataUri } from '@/lib/board/theme-customization'
import themeStyles from '@/components/board/themes.module.css'
import type { PresetId } from '@/lib/board/tune-presets'
import { PRESETS } from '@/lib/board/tune-presets'
import { detectUrlType } from '@/lib/utils/url'
import { CardsLayer } from '@/components/board/CardsLayer'
import { Lightbox } from '@/components/board/Lightbox'
import { ScrollMeter } from '@/components/board/ScrollMeter'
import { TopHeader } from '@/components/board/TopHeader'
import { MotionToggle } from '@/components/board/MotionToggle'
import { ChromeLedToggle } from '@/components/board/ChromeLedToggle'
import { ChromeButton } from '@/components/board/ChromeButton'
import { TuneTrigger } from '@/components/board/TuneTrigger'
import { BlockedChrome } from '@/components/board/BlockedChrome'
import { ImportProgressIndicator } from './ImportProgressIndicator'
import { SenderShareModal } from './SenderShareModal'
import { buildShareDataFromBoard } from '@/lib/share/board-to-share'
import type { MirrorItem, MirrorPosition } from './ShareMirror'
import frame from '@/components/board/BoardRoot.module.css'
import styles from './SharedBoard.module.css'

/** Stable module-level no-op for every editing handler CardsLayer requires but
 *  the receiver view never uses. One shared identity keeps CardsLayer's memos
 *  from churning on every render. */
const NOOP = (): void => {}

/** Stable empty collection — passing a fresh `new Set()` inline would give
 *  CardsLayer a new reference each render and defeat its memoization. */
const EMPTY_SET: ReadonlySet<string> = new Set()

/** Stable empty per-card width map — fed in place of the sender's customWidths
 *  while the mobile layout override is active (mirrors BoardRoot's
 *  EMPTY_CUSTOM_WIDTHS at BoardRoot.tsx:202), so every card falls back to the
 *  uniform mobile column width instead of the sender's free-resized width. */
const EMPTY_CUSTOM_WIDTHS: Readonly<Record<string, number>> = {}

/** Huge viewport height so CardsLayer's culling window never drops a card.
 *  The receiver board is a normal scrolling container (capped at 100 cards),
 *  not a panning canvas, so feeding a near-infinite height keeps every card
 *  mounted and lets the browser's own scroll handle visibility. Tier-1
 *  autoplay stays correct because it is driven by IntersectionObserver on the
 *  real DOM, independent of this culling math. */
const UNCULLED_VIEWPORT_H = 1e7

/** Fallback gap for shares created before the sender packed its own gap. */
const RECEIVER_FALLBACK_GAP_PX = BOARD_SLIDERS.CARD_GAP_DEFAULT_PX

/** Minimum time the "importing" phase stays on screen so the working
 *  animation always plays in full, even for a near-instant (few-card) write.
 *  ~1.2s comfortably covers the backdrop/panel appear (~0.44s) plus a full
 *  loop of the 0.9s sound-wave. */
const MIN_IMPORTING_MS = 1200

type BoardState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly data: ShareDataV2 }
  | {
      readonly kind: 'error'
      readonly code: 'not_found' | 'expired' | 'invalid' | 'server'
      readonly message: string
    }

export function SharedBoard(): ReactElement {
  const router = useRouter()
  const [state, setState] = useState<BoardState>({ kind: 'loading' })
  const [shareId, setShareId] = useState<string | null>(null)

  // Working-set + board-control state (only meaningful once state.kind === 'ready').
  const [removedUrls, setRemovedUrls] = useState<ReadonlySet<string>>(EMPTY_SET)
  const [cardWidthPx, setCardWidthPx] = useState<number>(BOARD_SLIDERS.CARD_WIDTH_DEFAULT_PX)
  const [gapPx, setGapPx] = useState<number>(RECEIVER_FALLBACK_GAP_PX)
  const [bgTypoEnabled, setBgTypoEnabled] = useState<boolean>(true)
  const [motionEnabled, setMotionEnabled] = useState<boolean>(true)
  // Local view preference for the receiver — like W/G, it isn't persisted (the
  // shared payload carries no corner style; the viewer just adjusts how they
  // look at it). Default rounded.
  const [roundedCorners, setRoundedCorners] = useState<boolean>(true)
  const [importPhase, setImportPhase] = useState<'idle' | 'importing' | 'done'>('idle')
  // SHARE re-share modal (Plan 2): re-share the currently-visible cards.
  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false)
  // Import result counts for the done-phase summary (mainstream "report only"
  // duplicate UX): how many were newly saved vs already on the user's board.
  const [importCounts, setImportCounts] = useState<{ added: number; skipped: number } | null>(null)

  const [hovered, setHovered] = useState<string | null>(null)
  const [containerWidth, setContainerWidth] = useState<number>(1200)
  // Scroller viewport height + live scrollTop — fed to the re-share mirror so
  // it reproduces the same vertical slice the receiver currently sees.
  const [containerHeight, setContainerHeight] = useState<number>(800)
  const [scrollTop, setScrollTop] = useState<number>(0)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [lightboxRect, setLightboxRect] = useState<DOMRect | null>(null)
  // Bookmark id of the card the lightbox opened from — drives the SAME
  // FLIP morph the board uses (CardsLayer hides this card while the cloned
  // proxy morphs; Lightbox reads it to build the clone + close back to it).
  const [lightboxSourceId, setLightboxSourceId] = useState<string | null>(null)
  // Scroll progress 0..1 for the ScrollMeter swell. 0 when not scrollable.
  const [swell, setSwell] = useState<number>(0)

  const containerRef = useRef<HTMLDivElement>(null)

  const onRemoveCard = useCallback((url: string): void => {
    setRemovedUrls((s) => {
      const n = new Set(s)
      n.add(url)
      return n
    })
  }, [])

  // ── boot: extract id ──
  useEffect((): void => {
    const extracted = extractShareIdFromPathname(window.location.pathname)
    if (!extracted.ok) {
      setState({ kind: 'error', code: 'invalid', message: 'invalid share URL' })
      return
    }
    setShareId(extracted.id)
  }, [])

  // ── boot: fetch + sanitize ──
  useEffect((): void => {
    if (!shareId) return
    void (async (): Promise<void> => {
      const result = await fetchShare(shareId)
      if (!result.ok) {
        const code = result.error === 'not_found' ? 'not_found' : 'server'
        setState({ kind: 'error', code, message: result.message })
        return
      }
      const parsed = sanitizeShareDataV2(result.data.share)
      if (!parsed.ok) {
        setState({ kind: 'error', code: 'invalid', message: parsed.error })
        return
      }
      const data = parsed.data
      // Seed the board controls from the sender's layout so TUNE behaves
      // identically to what the sender saw (W/G), with back-compat fallbacks.
      setCardWidthPx(data.w ?? BOARD_SLIDERS.CARD_WIDTH_DEFAULT_PX)
      setGapPx(data.gap ?? RECEIVER_FALLBACK_GAP_PX)
      setState({ kind: 'ready', data })
    })()
  }, [shareId])

  // ── container width via ResizeObserver ──
  useEffect((): (() => void) | undefined => {
    if (state.kind !== 'ready') return undefined
    const el = containerRef.current
    if (!el) return undefined
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect && rect.width > 0) setContainerWidth(rect.width)
      if (rect && rect.height > 0) setContainerHeight(rect.height)
    })
    ro.observe(el)
    return (): void => ro.disconnect()
  }, [state.kind])

  // ── scroll meter wiring ──
  // The receiver board is a normal vertical scroller (containerRef). Keep the
  // meter's swell synced to scroll progress, and translate scrub fractions
  // back into a scrollTop.
  const handleScroll = useCallback((): void => {
    const el = containerRef.current
    if (!el) return
    const range = el.scrollHeight - el.clientHeight
    setSwell(range > 0 ? Math.max(0, Math.min(1, el.scrollTop / range)) : 0)
    setScrollTop(el.scrollTop)
  }, [])

  // Forward the re-share modal's wheel to the receiver's own scroller so the
  // background board pans in sync with the mirror (matches the sender flow).
  // Setting scrollTop fires onScroll, which updates swell + scrollTop state.
  const handleSharePanY = useCallback((deltaY: number): void => {
    const el = containerRef.current
    if (!el) return
    el.scrollTop += deltaY
  }, [])
  const handleMeterScrub = useCallback((fraction: number): void => {
    const el = containerRef.current
    if (!el) return
    const range = el.scrollHeight - el.clientHeight
    if (range <= 0) return
    el.scrollTop = Math.max(0, Math.min(1, fraction)) * range
  }, [])

  // ── lightbox ──
  const closeLightbox = useCallback((): void => {
    setLightboxIndex(null)
    setLightboxRect(null)
    setLightboxSourceId(null)
  }, [])
  // Fired mid close-tween (when the morph clone lands back on the source
  // card) so the hidden source card reappears one frame before unmount —
  // mirrors BoardRoot.handleLightboxSourceShouldShow.
  const showLightboxSource = useCallback((): void => {
    setLightboxSourceId(null)
  }, [])

  // ── visible (working) cards = sender cards minus the ones × removed ──
  const visibleCards = useMemo(
    () => (state.kind === 'ready' ? state.data.cards.filter((c) => !removedUrls.has(c.u)) : []),
    [state, removedUrls],
  )

  const onCardClick = useCallback(
    (bookmarkId: string, originRect: DOMRect): void => {
      const idx = visibleCards.findIndex((c) => c.u === bookmarkId)
      if (idx < 0) return
      setLightboxRect(originRect)
      setLightboxIndex(idx)
      setLightboxSourceId(bookmarkId)
    },
    [visibleCards],
  )

  // ── TUNE preset application (matches BoardRoot.onApplyPreset signature) ──
  const onApplyPreset = useCallback((id: PresetId): void => {
    const preset = PRESETS.find((p) => p.id === id)
    if (!preset) return
    setCardWidthPx(preset.w)
    setGapPx(preset.g)
  }, [])

  // ── derived board data (re-based on visibleCards) ──
  const items = useMemo(
    () => visibleCards.map((c, i) => shareCardToBoardItem(c, i)),
    [visibleCards],
  )
  const senderTagIdsByCard = useMemo(
    () => new Map<string, ReadonlyArray<string>>(visibleCards.map((c) => [c.u, c.tg ?? []])),
    [visibleCards],
  )

  // Reproduce the sender's arrangement: each card keeps the exact width
  // (`cw`) the sender saw, keyed by bookmarkId (= the card URL). Feeding this
  // as CardsLayer's customWidths makes the masonry size every card to the
  // sender's value rather than a single uniform width.
  const customWidths = useMemo<Record<string, number>>(
    () => Object.fromEntries(visibleCards.map((c) => [c.u, c.cw])),
    [visibleCards],
  )

  // ── Mobile layout override (mirrors BoardRoot.tsx:1069-1084) ──────────────
  // On a narrow viewport the receiver renders a uniform N-column masonry sized
  // to the (already full-bleed) scroller width, ignoring the sender's saved
  // card-width/gap and per-card widths — same DISPLAY-ONLY override the real
  // board applies. `containerWidth` is the receiver's equivalent of
  // BoardRoot's `effectiveLayoutWidth` (both are the usable width the masonry
  // packs into). The raw `cardWidthPx`/`gapPx`/`customWidths` state is left
  // untouched (still the sender's arrangement) — only the values fed to the
  // skyline layout and CardsLayer below switch on mobile.
  const isMobile = useIsMobile()
  const mobileCardWidth = useMemo<number>(() => {
    const cols = MOBILE_LAYOUT.COLUMNS
    return Math.max(1, (containerWidth - (cols - 1) * MOBILE_LAYOUT.GAP_PX) / cols)
  }, [containerWidth])
  const layoutCardWidthPx = isMobile ? mobileCardWidth : cardWidthPx
  const layoutCardGapPx = isMobile ? MOBILE_LAYOUT.GAP_PX : gapPx
  const layoutCustomWidths = isMobile ? EMPTY_CUSTOM_WIDTHS : customWidths

  // CardsLayer's root is position:absolute (zero intrinsic height), so the
  // normal-scroll container needs an explicit spacer to become scrollable.
  // Replicate the SAME skyline layout CardsLayer renders to get the content's
  // total height. Text/tweet cards that report a taller intrinsic height
  // inside CardsLayer are approximated here by their aspect-ratio box — close
  // enough for a scroll range (spec: keep it simple).
  const skyline = useMemo<SkylineResult>(() => {
    if (containerWidth <= 0 || items.length === 0) {
      return { positions: {}, totalWidth: 0, totalHeight: 0 }
    }
    const cards: SkylineCard[] = items.map((it) => {
      const w = layoutCustomWidths[it.bookmarkId] ?? layoutCardWidthPx
      const h = it.aspectRatio > 0 ? w / it.aspectRatio : w
      return { id: it.bookmarkId, width: w, height: h }
    })
    return computeSkylineLayout({ cards, containerWidth, gap: layoutCardGapPx })
  }, [items, containerWidth, layoutCustomWidths, layoutCardGapPx, layoutCardWidthPx])
  const spacerHeight = skyline.totalHeight

  // ── bulk import → board ──
  const handleSave = useCallback(async (): Promise<void> => {
    if (state.kind !== 'ready') return
    const visible = state.data.cards.filter((c) => !removedUrls.has(c.u))
    if (visible.length === 0) return
    setImportPhase('importing')
    const startedAt = performance.now()
    try {
      const db = await initDB()
      // Dedupe against the receiver's existing (non-deleted) bookmarks so a
      // re-import never silently duplicates URLs already on the board. Deleted
      // URLs count as absent (policy: 削除済みは別扱い) so they can re-import.
      const existing = await getAllBookmarks(db)
      const existingUrls = new Set(existing.filter((b) => !b.isDeleted).map((b) => b.url))
      const fresh = visible.filter((c) => !existingUrls.has(c.u))
      // Report-only dup summary: surface added vs skipped in the done phase.
      setImportCounts({ added: fresh.length, skipped: visible.length - fresh.length })
      if (fresh.length > 0) {
        const inputs = orderForImport(fresh).map((c) => ({
          url: c.u,
          title: c.t,
          description: c.d ?? '',
          thumbnail: c.th ?? '',
          favicon: '',
          siteName: '',
          type: detectUrlType(c.u),
          tags: [] as string[],
        }))
        await addBookmarkBatch(db, inputs)
      }
      // Hold the "importing" phase for a floor duration so the working
      // animation always plays in full — even when the write is near-instant
      // (a handful of cards). Without this the wave would flash by before the
      // user registers it. The DB time already spent counts toward the floor.
      const elapsed = performance.now() - startedAt
      const remaining = MIN_IMPORTING_MS - elapsed
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining))
      setImportPhase('done')
    } catch {
      setImportPhase('idle')
    }
  }, [state, removedUrls])

  // After the done check shows briefly, navigate to the board.
  useEffect((): (() => void) | undefined => {
    if (importPhase !== 'done') return undefined
    // Hold the done state longer when there's a duplicate summary to read.
    const holdMs = (importCounts?.skipped ?? 0) > 0 ? 2000 : 900
    const t = window.setTimeout(() => router.push('/board'), holdMs)
    return (): void => window.clearTimeout(t)
  }, [importPhase, router, importCounts])

  // ── theme: mirror the board's html[data-theme-id] so globals.css blocks apply ──
  useEffect((): (() => void) => {
    if (typeof document === 'undefined') return (): void => undefined
    const el = document.documentElement
    const tid = state.kind === 'ready' ? (state.data.theme ?? DEFAULT_THEME_ID) : DEFAULT_THEME_ID
    el.setAttribute('data-theme-id', tid)
    return (): void => { el.removeAttribute('data-theme-id') }
  }, [state])

  // ── re-share (Plan 2): build a fresh share payload from the cards the
  // receiver currently sees (after × removals + TUNE width/gap). Reuses the
  // real sender builder so capping / truncation / tag-dict rebuild / type
  // detection all match a first-party share. Sender tags ride along as
  // read-only labels for the next receiver (= the collection's expression). ──
  const getShareData = useCallback((): ShareDataV2 => {
    const cards = state.kind === 'ready'
      ? state.data.cards.filter((c) => !removedUrls.has(c.u))
      : []
    const tagDict = state.kind === 'ready' ? (state.data.tags ?? {}) : {}
    return buildShareDataFromBoard({
      items: cards.map((c) => ({
        bookmarkId: c.u,
        url: c.u,
        title: c.t,
        description: c.d,
        thumbnail: c.th,
        aspectRatio: c.a,
        tags: c.tg ?? [],
        cardWidth: c.cw,
      })),
      tags: Object.entries(tagDict).map(([id, t]) => ({ id, name: t.n, color: t.c })),
      filter: null,
      now: Date.now(),
      themeId: (state.kind === 'ready' ? state.data.theme : undefined) ?? DEFAULT_THEME_ID,
      gap: gapPx,
      defaultWidth: cardWidthPx,
    })
  }, [state, removedUrls, gapPx, cardWidthPx])

  if (state.kind === 'loading') {
    return (
      <div className={styles.shell}>
        <p className={styles.loadingText}>LOADING SHARED COLLECTION</p>
      </div>
    )
  }

  if (state.kind === 'error') {
    const isExpired = state.code === 'not_found'
    return (
      <div className={styles.shell}>
        <div className={styles.errorBox}>
          <p className={styles.errorTitle}>
            {isExpired ? 'This share has expired or was never created' : 'Could not load share'}
          </p>
          <p className={styles.errorMessage}>{state.message}</p>
          <button type="button" className={styles.errorCta} onClick={(): void => router.push('/board')}>
            GO TO ALLMARKS
          </button>
        </div>
      </div>
    )
  }

  // ── ready ──
  const data = state.data
  // The shared board renders in the sender's theme: data-theme-id on <html> (effect above) drives the cascade; pattern themes also paint the patternLayer below.
  const themeId = data.theme ?? DEFAULT_THEME_ID
  const lightboxItem = lightboxIndex !== null ? (items[lightboxIndex] ?? null) : null
  const importing = importPhase !== 'idle'

  // Re-share mirror props, supplied from the receiver's own visible layout.
  const mirrorItems: MirrorItem[] = visibleCards.map((c) => ({
    id: c.u,
    url: c.u,
    title: c.t,
    thumbnailUrl: c.th ?? null,
  }))
  const mirrorPositions: MirrorPosition[] = Object.entries(skyline.positions).map(
    ([id, p]): MirrorPosition => ({ id, x: p.x, y: p.y, w: p.w, h: p.h }),
  )

  return (
    <div className={frame.outerFrame} data-theme={themeId}>
      {/* Outer top band — the receiver's primary actions (IMPORT) plus the
          reused MOTION switch and a blocked FILTER readout. Made inert while an
          import is running. */}
      <div
        className={frame.frameTopChrome}
        style={importing ? { pointerEvents: 'none' } : undefined}
      >
        <ChromeButton
          label={`IMPORT ${visibleCards.length} TO YOUR BOARD`}
          onClick={(): void => {
            void handleSave()
          }}
          disabled={visibleCards.length === 0 || importPhase !== 'idle'}
          data-testid="import-button"
        />
        <MotionToggle enabled={motionEnabled} onToggle={(): void => setMotionEnabled((v) => !v)} />
        <BlockedChrome label="FILTER">
          <ChromeButton label={`AllMarks · ${String(visibleCards.length).padStart(3, '0')}`} onClick={NOOP} />
        </BlockedChrome>
      </div>

      {/* Inner dark canvas — reuses the board's rounded dark stage. */}
      <div className={frame.canvas}>
        {(() => {
          const rc = resolveThemeCustomization(themeId, data.custom)
          if (!rc) return null // 'work' theme (Paper) — globals.css blocks handle it
          const uri = patternSvgDataUri(rc)
          return (
            <div
              aria-hidden="true"
              className={themeStyles.patternLayer}
              data-pattern={rc.patternType}
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: BOARD_Z_INDEX.THEME_BG,
                pointerEvents: 'none',
                backgroundColor: rc.boardColor,
                backgroundImage: uri ? `url("${uri}")` : undefined,
                backgroundSize: `${rc.patternSize}px ${rc.patternSize}px`,
              } as CSSProperties}
            />
          )
        })()}
        <TopHeader
          hidden={!!lightboxSourceId}
          actions={
            <span style={importing ? { pointerEvents: 'none' } : undefined}>
              <ChromeLedToggle
                label="TITLE"
                on={bgTypoEnabled}
                onToggle={(): void => setBgTypoEnabled((v) => !v)}
                wrapTestId="bgtypo-toggle-wrap"
                ledTestId="bgtypo-led"
                btnTestId="bgtypo-toggle"
              />
              <TuneTrigger
                widthPx={cardWidthPx}
                gapPx={gapPx}
                onChangeWidth={setCardWidthPx}
                onChangeGap={setGapPx}
                onReset={(): void => {
                  setCardWidthPx(data.w ?? BOARD_SLIDERS.CARD_WIDTH_DEFAULT_PX)
                  setGapPx(data.gap ?? RECEIVER_FALLBACK_GAP_PX)
                }}
                onApplyPreset={onApplyPreset}
                roundedCorners={roundedCorners}
                onToggleCorners={(): void => setRoundedCorners((v) => !v)}
                containerWidth={containerWidth}
              />
              <BlockedChrome label="MANAGE TAGS">
                <ChromeButton label="MANAGE TAGS" onClick={NOOP} />
              </BlockedChrome>
              <BlockedChrome label="POP OUT">
                <ChromeButton label="POP OUT" onClick={NOOP} />
              </BlockedChrome>
              <ChromeButton
                label="SHARE"
                onClick={(): void => setShareModalOpen(true)}
                disabled={importing || visibleCards.length === 0}
                data-testid="reshare-button"
              />
            </span>
          }
        />

        {/* Background wordmark — big faint headline behind the cards, like the
            board's BoardBackgroundTypography. Gated by the TITLE switch. */}
        {bgTypoEnabled && (
          <div className={styles.bgTypo} aria-hidden>
            SHARED WITH YOU
          </div>
        )}

        <div className={frame.canvasWrap} data-lightbox-clone-host>
          <div className={styles.scroller} ref={containerRef} onScroll={handleScroll}>
            {/* Flow spacer reserves the masonry's total height so the absolute
                CardsLayer becomes scrollable (it has no intrinsic height). */}
            <div aria-hidden style={{ height: `${spacerHeight}px` }} />
            <CardsLayer
              roundedCorners={roundedCorners}
              items={items}
              viewport={{ x: 0, y: 0, w: containerWidth, h: UNCULLED_VIEWPORT_H }}
              viewportWidth={containerWidth}
              cardGapPx={layoutCardGapPx}
              hoveredBookmarkId={hovered}
              onHoverChange={setHovered}
              audioActiveId={null}
              onToggleAudio={NOOP}
              audioVolume={1}
              audioPaused={false}
              onAudioVolumeChange={NOOP}
              onAudioTogglePause={NOOP}
              spaceHeld={false}
              onClick={onCardClick}
              sourceCardId={lightboxSourceId}
              onDrop={NOOP}
              onDelete={NOOP}
              onCardResize={NOOP}
              onCardResizeEnd={NOOP}
              onCardResetSize={NOOP}
              displayMode={'visual'}
              newlyAddedIds={EMPTY_SET}
              defaultCardWidth={layoutCardWidthPx}
              customWidths={layoutCustomWidths}
              themeId={themeId}
              motionEnabled={motionEnabled}
              matchedBookmarkIds={null}
              receiverMode={{
                removedUrls,
                senderTags: data.tags ?? {},
                senderTagIdsByCard,
                onRemove: onRemoveCard,
              }}
            />
          </div>
        </div>

        {/* Theme-driven import overlay (backdrop covers the canvas at z 300). */}
        <ImportProgressIndicator phase={importPhase} themeId={themeId} counts={importCounts} />
      </div>

      {/* Bottom frame band — mirror of BoardRoot's frameBottomChrome
          (BoardRoot.tsx:2886-2899). Hosts the ScrollMeter in the outer frame's
          bottom margin, OUTSIDE the dark canvas, so it matches the real
          board's current position (s170) instead of the old hand-rolled
          canvas-bottom overlay. Hidden on mobile, matching the real board. */}
      <div className={frame.frameBottomChrome}>
        {!isMobile && (
          <ScrollMeter
            mode="board"
            n1={1}
            n2={visibleCards.length}
            total={visibleCards.length}
            swellFraction={swell}
            onScrub={handleMeterScrub}
            variant={getThemeMeta(themeId).scrollMeterVariant}
          />
        )}
      </div>

      {lightboxItem && (
        <Lightbox
          item={lightboxItem}
          originRect={lightboxRect}
          sourceCardId={lightboxSourceId}
          onSourceShouldShow={showLightboxSource}
          onClose={closeLightbox}
          themeId={themeId}
        />
      )}

      {/* Re-share: build a new share from the cards still visible here. Reuses
          the first-party sender modal + mirror preview + capture pipeline. */}
      <SenderShareModal
        open={shareModalOpen}
        onClose={(): void => setShareModalOpen(false)}
        getShareData={getShareData}
        totalBoardCount={visibleCards.length}
        scrollY={scrollTop}
        contentHeight={spacerHeight + BOARD_TOP_PAD_PX}
        viewportHeight={containerHeight}
        activeTagNames={[]}
        onPanY={handleSharePanY}
        items={mirrorItems}
        positions={mirrorPositions}
        bgViewportWidth={containerWidth}
        bgCanvasWidth={containerWidth + 2 * BOARD_INNER.SIDE_PADDING_PX}
        bgTypoEnabled={bgTypoEnabled}
        bgTypoText="SHARED WITH YOU"
        themeId={themeId}
        custom={resolveThemeCustomization(themeId, data.custom)}
      />
    </div>
  )
}
