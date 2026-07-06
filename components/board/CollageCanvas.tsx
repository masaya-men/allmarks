'use client'

import { useRef, type PointerEvent, type ReactElement } from 'react'
import { CardNode } from './CardNode'
import { ResizeHandle } from './ResizeHandle'
import { ShareTitleElement } from './ShareTitleElement'
import { pickCard } from './cards'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import type { DisplayMode } from '@/lib/board/types'
import type { BoardItem } from '@/lib/storage/use-board-data'
import type { CollagePositions, CollageResizeCorner } from '@/lib/share/collage-layout'
import type { ShareTitleConfig } from '@/lib/share/share-title'
import styles from './CollageCanvas.module.css'

export type CollageCanvasProps = {
  /** The selected board cards, as full BoardItems — so each renders its REAL
   *  card face (pickCard → ImageCard / VideoThumbCard / PlaceholderCard), the
   *  same as on the board. Keyed for layout by `bookmarkId`. */
  readonly items: ReadonlyArray<BoardItem>
  /** Current free-placement layout, owned by the parent (BoardRoot). Keyed by bookmarkId. */
  readonly positions: CollagePositions
  /** Overlap order — last id is frontmost. Owned by the parent. */
  readonly order: readonly string[]
  readonly onMove: (id: string, x: number, y: number) => void
  /** Resize keeping the grabbed corner's diagonal opposite fixed (the parent
   *  applies resizeElementFromCorner). */
  readonly onResize: (id: string, corner: CollageResizeCorner, nextWidth: number) => void
  /** Fired on pointerdown so the parent can bringToFront(order, id). */
  readonly onGrab: (id: string) => void
  /** Upper bound for a card's resized width (board px) — passed straight to the
   *  shared ResizeHandle so a card can grow up to "edge to edge" of the arrange
   *  area. Matches the board's effectiveLayoutWidth. */
  readonly maxCardWidth: number
  /** Board display mode, forwarded to each card face. */
  readonly displayMode: DisplayMode
  /** True on paper themes (themeMeta.decorations) — renders the paper card face. */
  readonly paper: boolean
  /** Editable collage title (phase 2), owned by the parent. Omitted/undefined
   *  renders no title layer at all — the arrange stage can run without one. */
  readonly title?: {
    readonly config: ShareTitleConfig
    readonly defaultText: string
    readonly onChange: (next: ShareTitleConfig) => void
  }
}

/** Intra-canvas stacking floor. This is a LOCAL offset for ordering this
 *  component's own elements relative to each other (via `order.indexOf`) —
 *  it has nothing to do with the canvas root's global stacking, which comes
 *  from BOARD_Z_INDEX (SHARE_CANVAS, applied to .root below). */
const INTRA_CANVAS_Z_BASE = 10

/** Free-placement arrange layer for the SHARE collage rebuild. Renders each
 *  selected card (its real board face) as an absolutely-positioned,
 *  drag-movable, corner-resizable element. Layout state (positions/order) is
 *  lifted to the parent — this component only translates pointer gestures into
 *  the `onMove`/`onResize`/`onGrab` callbacks and never mutates layout itself.
 *  Cards render static (autoCycle/ambientOn off) so the arrange view holds still
 *  for the user's screenshot. */
export function CollageCanvas(props: CollageCanvasProps): ReactElement {
  const refs = useRef<Record<string, HTMLDivElement | null>>({})
  /** The corner grabbed for the in-flight resize (one resize at a time), set on
   *  ResizeHandle's onResizeStart and read on each onResize so the parent can
   *  anchor the opposite corner. */
  const activeResizeCorner = useRef<CollageResizeCorner>('br')

  /** Shared pointer-gesture plumbing for drag-move: captures the pointer
   *  (best-effort — jsdom/synthetic pointers don't support capture, which is
   *  fine since it's only a UX nicety, not load bearing), wires up
   *  move/up/cancel listeners, and tears everything down (including releasing
   *  capture) on end. The caller supplies the gesture-specific math via
   *  `onMove`. (Corner-resize is delegated to the shared ResizeHandle, which
   *  has its own capture plumbing — see below.) */
  function bindPointerGesture(
    el: HTMLDivElement,
    pointerId: number,
    onMove: (ev: globalThis.PointerEvent) => void,
  ): void {
    try {
      el.setPointerCapture(pointerId)
    } catch {
      /* jsdom / synthetic pointer — capture isn't critical for the gesture itself */
    }
    const move = (ev: globalThis.PointerEvent): void => {
      onMove(ev)
    }
    const up = (): void => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      try {
        if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId)
      } catch {
        /* jsdom / synthetic pointer */
      }
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  function handleElementPointerDown(e: PointerEvent<HTMLDivElement>, id: string): void {
    if (e.button > 0) return
    e.stopPropagation()
    const el = refs.current[id]
    const start = props.positions[id]
    if (!el || !start) return
    props.onGrab(id)
    const startX = e.clientX
    const startY = e.clientY
    const originX = start.x
    const originY = start.y
    bindPointerGesture(el, e.pointerId, (ev) => {
      props.onMove(id, originX + (ev.clientX - startX), originY + (ev.clientY - startY))
    })
  }

  return (
    <div className={styles.root} style={{ zIndex: BOARD_Z_INDEX.SHARE_CANVAS }} data-testid="collage-canvas">
      {/* Title layer renders FIRST (before the cards below) so it paints
          behind them within this stacking context: cards carry explicit
          positive zIndex (INTRA_CANVAS_Z_BASE+), while the title's root stays
          at the CSS default z-index:auto — DOM order alone then puts it under
          any card, matching spec's "title behind cards by default". */}
      {props.title && (
        <ShareTitleElement
          config={props.title.config}
          defaultText={props.title.defaultText}
          onChange={props.title.onChange}
        />
      )}
      {props.items.map((item) => {
        const id = item.bookmarkId
        const p = props.positions[id]
        if (!p) return null
        const z = INTRA_CANVAS_Z_BASE + Math.max(0, props.order.indexOf(id))
        const Card = pickCard(item)
        return (
          <div
            key={id}
            ref={(el): void => {
              refs.current[id] = el
            }}
            className={styles.element}
            data-testid={`collage-el-${id}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: `${p.w}px`,
              height: `${p.h}px`,
              transform: `translate(${p.x}px, ${p.y}px)`,
              zIndex: z,
            }}
            onPointerDown={(e): void => handleElementPointerDown(e, id)}
          >
            {/* Render the SAME card face the board renders (pickCard body inside
                CardNode), so text/placeholder and video cards show properly —
                not just a bare thumbnail+title. Static for a stable screenshot. */}
            <CardNode id={id} title={item.title} thumbnailUrl={item.thumbnail}>
              <Card
                item={item}
                cardWidth={p.w}
                cardHeight={p.h}
                displayMode={item.displayMode ?? props.displayMode}
                autoCycle={false}
                ambientOn={false}
                paper={props.paper}
              />
            </CardNode>
            {/* Reuse the board's exact resize affordance: four corner hot zones
                that reveal a 1/4-circle arc on hover. Its handles stopPropagation
                on pointerdown, so grabbing a corner never starts a card move.
                onResizeStart records the grabbed corner (so the parent anchors
                the opposite corner) and brings the card forward. */}
            <ResizeHandle
              cardWidth={p.w}
              cardHeight={p.h}
              maxCardWidth={props.maxCardWidth}
              // Free-floating collage cards: continuous diagonal-projection resize
              // so an off-diagonal drag can't make the card leap size (the board's
              // default per-axis 'dominant' model does — see resize-math.ts).
              resizeModel="projection"
              onResizeStart={(corner): void => {
                activeResizeCorner.current = corner
                props.onGrab(id)
              }}
              onResize={(w): void => props.onResize(id, activeResizeCorner.current, w)}
            />
          </div>
        )
      })}
    </div>
  )
}
