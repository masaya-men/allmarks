'use client'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react'
import { useRouter } from 'next/navigation'
import { fetchShare } from '@/lib/share/api-client'
import { sanitizeShareDataV2 } from '@/lib/share/validate-v2'
import { extractShareIdFromPathname } from '@/lib/share/extract-share-id'
import type { ShareDataV2 } from '@/lib/share/types-v2'
import { initDB, addBookmarkBatch } from '@/lib/storage/indexeddb'
import { orderForImport } from '@/lib/share/receiver-import-order'
import { shareCardToBoardItem } from '@/lib/share/share-card-to-board-item'
import { computeSkylineLayout, type SkylineCard } from '@/lib/board/skyline-layout'
import { BOARD_SLIDERS } from '@/lib/board/constants'
import { DEFAULT_THEME_ID } from '@/lib/board/theme-registry'
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
import frame from '@/components/board/BoardRoot.module.css'
import styles from './SharedBoard.module.css'

/** Stable module-level no-op for every editing handler CardsLayer requires but
 *  the receiver view never uses. One shared identity keeps CardsLayer's memos
 *  from churning on every render. */
const NOOP = (): void => {}

/** Stable empty collection — passing a fresh `new Set()` inline would give
 *  CardsLayer a new reference each render and defeat its memoization. */
const EMPTY_SET: ReadonlySet<string> = new Set()

/** Huge viewport height so CardsLayer's culling window never drops a card.
 *  The receiver board is a normal scrolling container (capped at 100 cards),
 *  not a panning canvas, so feeding a near-infinite height keeps every card
 *  mounted and lets the browser's own scroll handle visibility. Tier-1
 *  autoplay stays correct because it is driven by IntersectionObserver on the
 *  real DOM, independent of this culling math. */
const UNCULLED_VIEWPORT_H = 1e7

/** Fallback gap for shares created before the sender packed its own gap. */
const RECEIVER_FALLBACK_GAP_PX = BOARD_SLIDERS.CARD_GAP_DEFAULT_PX

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
  const [importPhase, setImportPhase] = useState<'idle' | 'importing' | 'done'>('idle')

  const [hovered, setHovered] = useState<string | null>(null)
  const [containerWidth, setContainerWidth] = useState<number>(1200)
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
      const w = entries[0]?.contentRect.width
      if (w && w > 0) setContainerWidth(w)
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

  // CardsLayer's root is position:absolute (zero intrinsic height), so the
  // normal-scroll container needs an explicit spacer to become scrollable.
  // Replicate the SAME skyline layout CardsLayer renders to get the content's
  // total height. Text/tweet cards that report a taller intrinsic height
  // inside CardsLayer are approximated here by their aspect-ratio box — close
  // enough for a scroll range (spec: keep it simple).
  const spacerHeight = useMemo<number>(() => {
    if (containerWidth <= 0 || items.length === 0) return 0
    const cards: SkylineCard[] = items.map((it) => {
      const w = customWidths[it.bookmarkId] ?? cardWidthPx
      const h = it.aspectRatio > 0 ? w / it.aspectRatio : w
      return { id: it.bookmarkId, width: w, height: h }
    })
    const layout = computeSkylineLayout({
      cards,
      containerWidth,
      gap: gapPx,
    })
    return layout.totalHeight
  }, [items, containerWidth, customWidths, gapPx, cardWidthPx])

  // ── bulk import → board ──
  const handleSave = useCallback(async (): Promise<void> => {
    if (state.kind !== 'ready') return
    const visible = state.data.cards.filter((c) => !removedUrls.has(c.u))
    if (visible.length === 0) return
    setImportPhase('importing')
    try {
      const db = await initDB()
      const inputs = orderForImport(visible).map((c) => ({
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
      setImportPhase('done')
    } catch {
      setImportPhase('idle')
    }
  }, [state, removedUrls])

  // After the done check shows briefly, navigate to the board.
  useEffect((): (() => void) | undefined => {
    if (importPhase !== 'done') return undefined
    const t = window.setTimeout(() => router.push('/board'), 900)
    return (): void => window.clearTimeout(t)
  }, [importPhase, router])

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
  // Theme is carried but not applied yet (no theme-application system on the
  // board). Default styling only; the import indicator reads it.
  const themeId = data.theme ?? DEFAULT_THEME_ID
  const lightboxItem = lightboxIndex !== null ? (items[lightboxIndex] ?? null) : null
  const importing = importPhase !== 'idle'

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
              />
              <BlockedChrome label="MANAGE TAGS">
                <ChromeButton label="MANAGE TAGS" onClick={NOOP} />
              </BlockedChrome>
              <BlockedChrome label="POP OUT">
                <ChromeButton label="POP OUT" onClick={NOOP} />
              </BlockedChrome>
              <BlockedChrome label="SHARE">
                <ChromeButton label="SHARE" onClick={NOOP} />
              </BlockedChrome>
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
              items={items}
              viewport={{ x: 0, y: 0, w: containerWidth, h: UNCULLED_VIEWPORT_H }}
              viewportWidth={containerWidth}
              cardGapPx={gapPx}
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
              defaultCardWidth={cardWidthPx}
              customWidths={customWidths}
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

        {/* Sound-wave scroll meter, placed at the canvas bottom like the board. */}
        <ScrollMeter
          mode="board"
          n1={1}
          n2={visibleCards.length}
          total={visibleCards.length}
          swellFraction={swell}
          onScrub={handleMeterScrub}
        />

        {/* Theme-driven import overlay (backdrop covers the canvas at z 300). */}
        <ImportProgressIndicator phase={importPhase} themeId={themeId} />
      </div>

      {lightboxItem && (
        <Lightbox
          item={lightboxItem}
          originRect={lightboxRect}
          sourceCardId={lightboxSourceId}
          onSourceShouldShow={showLightboxSource}
          onClose={closeLightbox}
        />
      )}
    </div>
  )
}
