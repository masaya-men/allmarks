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
import { initDB, addBookmark, getAllBookmarks } from '@/lib/storage/indexeddb'
import { addTag, getAllTags } from '@/lib/storage/tags'
import { findDuplicates, convertSenderTagsForReceiver, type ReceiverTagLite } from '@/lib/share/import'
import { initialIncludeSet, toggleInclude, toggleSenderTag } from '@/lib/share/receiver-selection'
import { shareCardToBoardItem } from '@/lib/share/share-card-to-board-item'
import { computeSkylineLayout, type SkylineCard } from '@/lib/board/skyline-layout'
import { BOARD_SLIDERS } from '@/lib/board/constants'
import { DEFAULT_THEME_ID } from '@/lib/board/theme-registry'
import { detectUrlType } from '@/lib/utils/url'
import { CardsLayer } from '@/components/board/CardsLayer'
import { Lightbox } from '@/components/board/Lightbox'
import { ScrollMeter } from '@/components/board/ScrollMeter'
import { BulkImportToast } from './BulkImportToast'
import frame from '@/components/board/BoardRoot.module.css'
import styles from './SharedBoard.module.css'

/** Stable module-level no-op for every editing handler CardsLayer requires but
 *  the receiver view never uses. One shared identity keeps CardsLayer's memos
 *  from churning on every render. */
const NOOP = (): void => {}

/** Stable empty collection — passing a fresh `new Set()` inline would give
 *  CardsLayer a new reference each render and defeat its memoization. */
const EMPTY_SET: ReadonlySet<string> = new Set()

/** Receiver-mode default tag color when the sender supplied none. */
const DEFAULT_TAG_COLOR = '#28F100'

/** Huge viewport height so CardsLayer's culling window never drops a card.
 *  The receiver board is a normal scrolling container (capped at 100 cards),
 *  not a panning canvas, so feeding a near-infinite height keeps every card
 *  mounted and lets the browser's own scroll handle visibility. Tier-1
 *  autoplay stays correct because it is driven by IntersectionObserver on the
 *  real DOM, independent of this culling math. */
const UNCULLED_VIEWPORT_H = 1e7

/** Fallback layout inputs for shares created before the sender packed its
 *  own gap (and as the default-width baseline). These mirror the board's own
 *  DEFAULT preset (BOARD_SLIDERS) so an old share still renders as a real
 *  board layout rather than an arbitrary one. Per-card widths always come from
 *  each card's `cw`; the gap comes from the share's `gap` when present. */
const RECEIVER_DEFAULT_CARD_WIDTH = BOARD_SLIDERS.CARD_WIDTH_DEFAULT_PX
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

  // Selection state (only meaningful once state.kind === 'ready').
  const [included, setIncluded] = useState<ReadonlySet<string>>(EMPTY_SET)
  const [chosenTags, setChosenTags] = useState<ReadonlyMap<string, Set<string>>>(new Map())
  const [dups, setDups] = useState<ReadonlySet<string>>(EMPTY_SET)

  const [hovered, setHovered] = useState<string | null>(null)
  const [containerWidth, setContainerWidth] = useState<number>(1200)
  const [importing, setImporting] = useState<boolean>(false)
  const [importResult, setImportResult] = useState<{ saved: number; skipped: number } | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [lightboxRect, setLightboxRect] = useState<DOMRect | null>(null)
  // Bookmark id of the card the lightbox opened from — drives the SAME
  // FLIP morph the board uses (CardsLayer hides this card while the cloned
  // proxy morphs; Lightbox reads it to build the clone + close back to it).
  const [lightboxSourceId, setLightboxSourceId] = useState<string | null>(null)
  // Scroll progress 0..1 for the ScrollMeter swell. 0 when not scrollable.
  const [swell, setSwell] = useState<number>(0)

  const containerRef = useRef<HTMLDivElement>(null)

  // ── boot: extract id ──
  useEffect((): void => {
    const extracted = extractShareIdFromPathname(window.location.pathname)
    if (!extracted.ok) {
      setState({ kind: 'error', code: 'invalid', message: 'invalid share URL' })
      return
    }
    setShareId(extracted.id)
  }, [])

  // ── boot: fetch + sanitize + duplicate scan ──
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
      const db = await initDB()
      const existing = await getAllBookmarks(db)
      const existingUrls = new Set(existing.filter((b) => !b.isDeleted).map((b) => b.url))
      const duplicates = findDuplicates(data.cards, existingUrls)
      setDups(duplicates)
      setIncluded(initialIncludeSet(data.cards.map((c) => c.u), duplicates))
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

  // ── selection toggles ──
  const onToggleInclude = useCallback((url: string): void => {
    setIncluded((s) => toggleInclude(s, url))
  }, [])
  const onToggleSenderTag = useCallback((url: string, tid: string): void => {
    setChosenTags((m) => toggleSenderTag(m, url, tid))
  }, [])

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

  const onCardClick = useCallback((bookmarkId: string, originRect: DOMRect): void => {
    if (state.kind !== 'ready') return
    const idx = state.data.cards.findIndex((c) => c.u === bookmarkId)
    if (idx < 0) return
    setLightboxRect(originRect)
    setLightboxIndex(idx)
    setLightboxSourceId(bookmarkId)
  }, [state])

  // ── derived board data ──
  const items = useMemo(
    () => (state.kind === 'ready' ? state.data.cards.map((c, i) => shareCardToBoardItem(c, i)) : []),
    [state],
  )
  const senderTagIdsByCard = useMemo(
    () =>
      new Map<string, ReadonlyArray<string>>(
        state.kind === 'ready' ? state.data.cards.map((c) => [c.u, c.tg ?? []]) : [],
      ),
    [state],
  )

  // Reproduce the sender's arrangement: each card keeps the exact width
  // (`cw`) the sender saw, keyed by bookmarkId (= the card URL). Feeding this
  // as CardsLayer's customWidths makes the masonry size every card to the
  // sender's value rather than a single uniform width.
  const customWidths = useMemo<Record<string, number>>(
    () =>
      state.kind === 'ready'
        ? Object.fromEntries(state.data.cards.map((c) => [c.u, c.cw]))
        : {},
    [state],
  )
  // Global masonry gap: the sender's value when present, else the board's
  // DEFAULT-preset gap (old shares created before `gap` was carried).
  const gapPx = useMemo<number>(
    () => (state.kind === 'ready' ? state.data.gap ?? RECEIVER_FALLBACK_GAP_PX : RECEIVER_FALLBACK_GAP_PX),
    [state],
  )

  // CardsLayer's root is position:absolute (zero intrinsic height), so the
  // normal-scroll container needs an explicit spacer to become scrollable.
  // Replicate the SAME skyline layout CardsLayer renders (uniform 320px width,
  // 16px gap) to get the content's total height. Text/tweet cards that report
  // a taller intrinsic height inside CardsLayer are approximated here by their
  // aspect-ratio box — close enough for a scroll range (spec: keep it simple).
  const spacerHeight = useMemo<number>(() => {
    if (containerWidth <= 0 || items.length === 0) return 0
    const cards: SkylineCard[] = items.map((it) => {
      const w = customWidths[it.bookmarkId] ?? RECEIVER_DEFAULT_CARD_WIDTH
      const h = it.aspectRatio > 0 ? w / it.aspectRatio : w
      return { id: it.bookmarkId, width: w, height: h }
    })
    const layout = computeSkylineLayout({
      cards,
      containerWidth,
      gap: gapPx,
    })
    return layout.totalHeight
  }, [items, containerWidth, customWidths, gapPx])

  // ── bulk import (SAVE N / M) ──
  const handleSave = useCallback(async (): Promise<void> => {
    if (state.kind !== 'ready') return
    const data = state.data
    setImporting(true)
    try {
      const db = await initDB()
      // Running list of receiver tags so name-dedupe + `order` stay correct
      // across cards (two cards sharing one new sender tag create it once).
      const working: ReceiverTagLite[] = (await getAllTags(db)).map((t) => ({ id: t.id, name: t.name }))
      const senderTags = data.tags ?? {}

      let saved = 0
      for (const c of data.cards) {
        if (!included.has(c.u)) continue
        const armed = [...(chosenTags.get(c.u) ?? [])]
        const conv = convertSenderTagsForReceiver(armed, senderTags, working)

        // sender tag id → resolved receiver tag id (existing or freshly created)
        const created = new Map<string, string>()
        for (const toCreate of conv.toCreate) {
          const tag = await addTag(db, {
            name: toCreate.name,
            color: toCreate.color ?? DEFAULT_TAG_COLOR,
            order: working.length,
          })
          created.set(toCreate.senderId, tag.id)
          working.push({ id: tag.id, name: tag.name })
        }

        const finalTagIds = armed
          .map((sid) => conv.existing.get(sid) ?? created.get(sid))
          .filter((x): x is string => Boolean(x))

        await addBookmark(db, {
          url: c.u,
          title: c.t,
          description: c.d ?? '',
          thumbnail: c.th ?? '',
          favicon: '',
          siteName: '',
          type: detectUrlType(c.u),
          tags: finalTagIds,
        })
        saved++
      }
      setImportResult({ saved, skipped: dups.size })
    } finally {
      setImporting(false)
    }
  }, [state, included, chosenTags, dups])

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
  // board). Default styling only.
  const themeId = data.theme ?? DEFAULT_THEME_ID
  const includeCount = included.size
  const total = data.cards.length
  const lightboxItem = lightboxIndex !== null ? (items[lightboxIndex] ?? null) : null

  return (
    <div className={frame.outerFrame} data-theme={themeId}>
      {/* Inner dark canvas — reuses the board's rounded dark stage. */}
      <div className={frame.canvas}>
        {/* Background wordmark — big faint headline behind the cards, like the
            board's BoardBackgroundTypography. */}
        <div className={styles.bgTypo} aria-hidden>
          SHARED WITH YOU
        </div>

        {/* SAVE control — plain monospace chrome text living INSIDE the dark
            moodboard (top-left), not jammed into the outer frame band. Green
            when there's a selection, muted at zero. Not a button rectangle. */}
        <button
          type="button"
          className={styles.saveChrome}
          data-active={includeCount > 0 ? 'true' : 'false'}
          disabled={importing || includeCount === 0}
          onClick={(): void => {
            void handleSave()
          }}
          data-testid="save-selected-btn"
        >
          {importing ? 'SAVING…' : `SAVE · ${includeCount} / ${total}`}
        </button>

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
              defaultCardWidth={RECEIVER_DEFAULT_CARD_WIDTH}
              customWidths={customWidths}
              motionEnabled={true}
              matchedBookmarkIds={null}
              receiverMode={{
                includedUrls: included,
                alreadySavedUrls: dups,
                senderTags: data.tags ?? {},
                senderTagIdsByCard,
                chosenTagsByCard: chosenTags,
                onToggleInclude,
                onToggleSenderTag,
              }}
            />
          </div>
        </div>

        {/* Sound-wave scroll meter, placed at the canvas bottom like the board. */}
        <ScrollMeter
          mode="board"
          n1={1}
          n2={total}
          total={total}
          swellFraction={swell}
          onScrub={handleMeterScrub}
        />
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

      {importResult && (
        <BulkImportToast
          saved={importResult.saved}
          skipped={importResult.skipped}
          onDismiss={(): void => {
            setImportResult(null)
            router.push('/board')
          }}
        />
      )}
    </div>
  )
}
