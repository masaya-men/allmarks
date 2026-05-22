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
import type { CardPosition, DisplayMode } from '@/lib/board/types'
import {
  BOARD_Z_INDEX,
  CULLING,
} from '@/lib/board/constants'
import { PRESETS } from '@/lib/board/tune-presets'
import type { BoardItem } from '@/lib/storage/use-board-data'
import { detectUrlType, isInstagramReel } from '@/lib/utils/url'
import { CardNode } from './CardNode'
import { MediaTypeIndicator, type MediaType } from './MediaTypeIndicator'
import { InlineMediaPlayer, canPlayInline, canViewportAutoplay } from './embeds'
import { PlaybackControlBar } from './PlaybackControlBar'
import { useViewportPlaybackPool } from '@/lib/board/use-viewport-playback-pool'
import { useStaggeredReveal } from '@/lib/board/use-staggered-reveal'
import { ResizeHandle } from './ResizeHandle'
import { CardCornerActions } from './CardCornerActions'
import { useCardReorderDrag, computeVirtualOrder, makeSkylineSimulator } from './use-card-reorder-drag'
import { pickCard } from './cards'

/** Minimum width for the playback control bar = the DENSE preset card width
 *  (207.80px). The bar tracks the active card's width but never shrinks below
 *  this, so its knob + button stay comfortably operable on tiny cards. */
const MIN_CONTROL_BAR_WIDTH_PX = PRESETS.find((p) => p.id === 'dense')?.w ?? 207.8

/** Maximum number of Tier 1 muted autoplay players active simultaneously.
 *  Experiment (session 65): set high so EVERY in-view video plays — the user
 *  wants to feel the full effect first. Re-tune for 60fps once they've seen it. */
const TIER1_CAP = 999

/** Derive the media-type badge for a bookmark from existing fields — no
 *  new persisted data needed. Returns null for cards where a video/photo
 *  badge wouldn't add information (text-only items: the card itself
 *  already reads as text). */
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
}: CardsLayerProps): ReactNode {
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  // Throttle: skip recomputing virtual order if card hasn't moved >8px since last compute.
  const lastComputeRef = useRef<{ x: number; y: number } | null>(null)

  // ── Tier 1 viewport autoplay ──
  // Intersection-observed visibility drives a debounced pool of up to TIER1_CAP
  // muted autoplay players. When motionEnabled is false the cap is 0, so the
  // pool stays empty and no observers are attached.
  const pool = useViewportPlaybackPool(motionEnabled ? TIER1_CAP : 0)
  // Mount players one-at-a-time (stagger) so a scroll into a band of video cards
  // ramps up instead of freezing the page with one big simultaneous-mount spike.
  const playing = useStaggeredReveal(pool.active)
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
        { threshold: [0, 0.25, 0.5, 0.75, 1] },
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
      const intrinsic = intrinsicHeights[it.bookmarkId]
      const w = resolveCardWidth(it.bookmarkId)
      const h =
        intrinsic && intrinsic > 0
          ? intrinsic
          : it.aspectRatio > 0
            ? w / it.aspectRatio
            : w
      return { id: it.bookmarkId, width: w, height: h }
    },
    [resolveCardWidth, intrinsicHeights],
  )


  const skylineCards = useMemo<SkylineCard[]>(
    () => items.map(buildSkylineCard),
    [items, buildSkylineCard],
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

  // During drag, use preview positions for non-dragged cards.
  // During drop/idle, use real masonry positions.
  const displayedPositions = useMemo<Readonly<Record<string, CardPosition>>>(
    () => previewMasonry?.positions ?? masonryLayout.positions,
    [previewMasonry, masonryLayout.positions],
  )

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

  // Previous-position ledger used to animate masonry reflows via FLIP.
  // Updated at the end of every effect run.
  const prevPositionsRef = useRef<Record<string, { x: number; y: number }>>({})

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
      } else {
        gsap.set(el, { x: p.x, y: p.y, width: p.w, height: p.h, overwrite: 'auto' })
      }
      prevPositionsRef.current[it.bookmarkId] = { x: p.x, y: p.y }
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
        const it = items.find((b) => b.bookmarkId === id)
        if (it?.url) window.open(it.url, '_blank', 'noopener,noreferrer')
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
        })

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
        // Reset throttle ref so next drag starts fresh.
        lastComputeRef.current = null

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
            prevPositionsRef.current[id] = { x: p.x, y: p.y }
          }
        }

        // Capture the dragged card's current DOM transform as its prev — FLIP in
        // the drop render animates from pointer position to new masonry slot.
        if (draggedId) {
          const el = cardRefs.current[draggedId]
          if (el) {
            const currentX = Number(gsap.getProperty(el, 'x'))
            const currentY = Number(gsap.getProperty(el, 'y'))
            prevPositionsRef.current[draggedId] = { x: currentX, y: currentY }
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
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: BOARD_Z_INDEX.CARDS,
        pointerEvents: 'none',
      }}
    >
      {visibleItems.map((it) => {
        const p = displayedPositions[it.bookmarkId]
        if (!p) return null
        return (
          <div
            key={it.bookmarkId}
            ref={(el): void => {
              cardRefs.current[it.bookmarkId] = el
              if (canViewportAutoplay(it)) observeViz(it.bookmarkId)(el)
            }}
            data-bookmark-id={it.bookmarkId}
            data-link-status={it.linkStatus ?? undefined}
            onPointerDown={(e: PointerEvent<HTMLDivElement>): void => handleReorderPointerDown(e, it.bookmarkId)}
            onPointerEnter={(): void => onHoverChange(it.bookmarkId)}
            onPointerLeave={(): void => onHoverChange(null)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: `${p.w}px`,
              height: `${p.h}px`,
              pointerEvents: sourceCardId === it.bookmarkId ? 'none' : 'auto',
              // Drag lifts highest (1000). The audio-active card (and thus its
              // attached control bar) floats above sibling cards at 500 so the
              // bar is never occluded by a later-painted neighbour. Idle cards
              // stack by DOM order (undefined).
              zIndex:
                dragState?.bookmarkId === it.bookmarkId
                  ? 1000
                  : audioActiveId === it.bookmarkId || barMount?.id === it.bookmarkId
                    ? 500
                    : undefined,
              opacity: newlyAddedIds.has(it.bookmarkId) ? 0 : 1,
              visibility: sourceCardId === it.bookmarkId ? 'hidden' : undefined,
              animation: newlyAddedIds.has(it.bookmarkId) ? 'booklage-entrance-a 400ms ease-out forwards' : undefined,
              ['--card-radius' as string]: '20px',
            }}
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
                  />
                )
              })()}
            </CardNode>
            {audioActiveId === it.bookmarkId && canPlayInline(it) && (
              // Tier 3 inline player overlay. stopPropagation on pointerdown
              // so interacting with the player (scrub, volume, fullscreen)
              // never engages the card's reorder-drag / open-lightbox gesture
              // wired on the wrapper above.
              <div
                onPointerDown={(e: PointerEvent<HTMLDivElement>): void => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  inset: 0,
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
              // Tier 1 muted viewport autoplay. pointerEvents:none so it never blocks
              // card clicks / resize. Excluded on the Tier 3 sound-on card, and on
              // cards that have been marked unplayable (embed-restricted etc.).
              <div
                data-viewport-playback
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 10,
                  overflow: 'hidden',
                  borderRadius: 'var(--card-radius, 20px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                <InlineMediaPlayer item={it} muted onUnplayable={(): void => markUnplayable(it.bookmarkId)} />
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
                  visible={audioActiveId === it.bookmarkId && hoveredBookmarkId === it.bookmarkId}
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
                visible={hoveredBookmarkId === it.bookmarkId}
                onActivate={(): void => onToggleAudio(it.bookmarkId)}
                active={audioActiveId === it.bookmarkId}
              />
            )}
            {/* CardCornerActions renders BEFORE ResizeHandle so the corner
                arcs can pick up button hover via the ~ sibling combinator
                (see ResizeHandle.module.css cross-module rules). Without
                this ordering, hovering × or ↺ silences the resize hint
                arcs in the corners they cover. */}
            <CardCornerActions
              hovered={hoveredBookmarkId === it.bookmarkId}
              hasCustomWidth={it.customCardWidth}
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
          </div>
        )
      })}
    </div>
  )
}
