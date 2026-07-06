'use client'

import { useRef, type PointerEvent, type ReactElement } from 'react'
import { CardNode } from './CardNode'
import { ResizeHandle } from './ResizeHandle'
import { ShareTitleElement } from './ShareTitleElement'
import { pickCard, paperCardHasTornBacking } from './cards'
import { PaperCardDecorations } from './decorations/PaperCardDecorations'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import type { DisplayMode } from '@/lib/board/types'
import type { BoardItem } from '@/lib/storage/use-board-data'
import type { CollagePositions, CollageResizeCorner } from '@/lib/share/collage-layout'
import { pointerAngleDeg, rotateFromPointer } from '@/lib/share/collage-rotate'
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
  /** Free rotation per card (deg), owned by the parent. Collage-only — the board
   *  grid never tilts. Missing id = 0°. */
  readonly rotations: Readonly<Record<string, number>>
  /** Fired on each rotate-handle move with the new absolute rotation (deg). */
  readonly onRotate: (id: string, deg: number) => void
  /** Upper bound for a card's resized width (board px) — passed straight to the
   *  shared ResizeHandle so a card can grow up to "edge to edge" of the arrange
   *  area. Matches the board's effectiveLayoutWidth. */
  readonly maxCardWidth: number
  /** Board display mode, forwarded to each card face. */
  readonly displayMode: DisplayMode
  /** True on paper themes (themeMeta.decorations) — renders the paper card face. */
  readonly paper: boolean
  /** Uniform fit scale (≤1) applied when seeding the collage, forwarded to the
   *  paper decorations so tape/pin/wax shrink WITH the shrunk cards. Omitted or 1
   *  = full board size (the board itself passes nothing). */
  readonly decoScale?: number
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

  /** Rotate-handle drag (industry-standard orbit around the card center).
   *  stopPropagation so grabbing the handle never starts a card move. The
   *  card center = the element's rect center; since the wrapper rotates around
   *  its own center, that center is stable through the whole gesture, so we
   *  capture it once at pointerdown. */
  function handleRotatePointerDown(e: PointerEvent<HTMLDivElement>, id: string): void {
    if (e.button > 0) return
    e.stopPropagation()
    e.preventDefault()
    const el = refs.current[id]
    if (!el) return
    props.onGrab(id)
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const startAngle = pointerAngleDeg(cx, cy, e.clientX, e.clientY)
    const startRotation = props.rotations[id] ?? 0
    bindPointerGesture(el, e.pointerId, (ev) => {
      const currentAngle = pointerAngleDeg(cx, cy, ev.clientX, ev.clientY)
      props.onRotate(id, rotateFromPointer({ startRotation, startAngle, currentAngle }))
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
        const rot = props.rotations[id] ?? 0
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
              // Rotation applies to the WHOLE element (card + paper shadow +
              // decorations + handles) so it tilts coherently, around its own
              // center (transform-origin default). Collage-only tilt — the board
              // grid never rotates.
              transform: `translate(${p.x}px, ${p.y}px) rotate(${rot}deg)`,
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
            {/* Paper themes: the SAME decorative craft layer the board draws
                (washi tape / push-pins), so a paper-theme collage matches the
                board card exactly. Presentational + pointer-events:none. */}
            {props.paper && (
              <PaperCardDecorations cardId={id} tornBacking={paperCardHasTornBacking(item)} scale={props.decoScale ?? 1} />
            )}
            {/* Rotation handle — industry-standard orbit affordance above the
                top-center. Hover-revealed (kept out of the screenshot at rest). */}
            <div
              className={styles.rotateHandle}
              data-testid={`collage-rotate-${id}`}
              onPointerDown={(e): void => handleRotatePointerDown(e, id)}
            >
              {/* Knob sits at the FAR END of the stem (top), the stem drops from
                  it down to the card's top edge — the Figma/Canva convention the
                  user asked for. Knob first in DOM + column layout = knob on top. */}
              <span className={styles.rotateKnob} aria-hidden="true">
                {/* Canva/Figma 風の回転アイコン（ほぼ全周の弧＋矢頭）。currentColor で白。 */}
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
                  <path
                    d="M19.5 12a7.5 7.5 0 1 1-2.6-5.7"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points="17.2 3.8 17.2 6.9 14.1 6.9"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className={styles.rotateStem} aria-hidden="true" />
            </div>
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
