'use client'

import { useRef, type PointerEvent, type ReactElement } from 'react'
import { CardNode } from './CardNode'
import type { ThemeId } from '@/lib/board/types'
import type { CollagePositions } from '@/lib/share/collage-layout'
import styles from './CollageCanvas.module.css'

/** One selected card as CollageCanvas needs to see it — id/title/thumbnail for
 *  CardNode, plus the source url (unused for render today, carried so the
 *  parent doesn't need a second lookup once export/link-out lands). */
export type CollageCanvasItem = {
  readonly id: string
  readonly title: string
  readonly thumbnailUrl: string | null
  readonly url: string
}

export type CollageCanvasProps = {
  readonly items: ReadonlyArray<CollageCanvasItem>
  /** Current free-placement layout, owned by the parent (BoardRoot). */
  readonly positions: CollagePositions
  /** Overlap order — last id is frontmost. Owned by the parent. */
  readonly order: readonly string[]
  readonly onMove: (id: string, x: number, y: number) => void
  readonly onResize: (id: string, nextWidth: number) => void
  /** Fired on pointerdown so the parent can bringToFront(order, id). */
  readonly onGrab: (id: string) => void
  readonly themeId: ThemeId
}

/** Intra-canvas stacking floor. This is a LOCAL offset for ordering this
 *  component's own elements relative to each other (via `order.indexOf`) —
 *  it has nothing to do with the canvas root's global stacking, which comes
 *  from BOARD_Z_INDEX once BoardRoot mounts this component (Task 4). */
const INTRA_CANVAS_Z_BASE = 10

/** Free-placement arrange layer for the SHARE collage rebuild. Renders each
 *  selected card as an absolutely-positioned, drag-movable, corner-resizable
 *  element. Layout state (positions/order) is lifted to the parent — this
 *  component only translates pointer gestures into the `onMove`/`onResize`/
 *  `onGrab` callbacks and never mutates layout itself. */
export function CollageCanvas(props: CollageCanvasProps): ReactElement {
  const refs = useRef<Record<string, HTMLDivElement | null>>({})

  /** Shared pointer-gesture plumbing for both drag-move and corner-resize:
   *  captures the pointer (best-effort — jsdom/synthetic pointers don't
   *  support capture, which is fine since it's only a UX nicety, not load
   *  bearing for either gesture), wires up move/up/cancel listeners, and
   *  tears everything down (including releasing capture) on end. Callers
   *  supply only the gesture-specific math via `onMove`; `onEnd` is for any
   *  extra per-gesture teardown beyond the shared listener/capture cleanup. */
  function bindPointerGesture(
    el: HTMLDivElement,
    pointerId: number,
    onMove: (ev: globalThis.PointerEvent) => void,
    onEnd?: () => void,
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
      onEnd?.()
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

  function handleResizePointerDown(e: PointerEvent<HTMLDivElement>, id: string): void {
    e.stopPropagation()
    e.preventDefault()
    const el = refs.current[id]
    const start = props.positions[id]
    if (!el || !start) return
    const startX = e.clientX
    const startW = start.w
    bindPointerGesture(el, e.pointerId, (ev) => {
      props.onResize(id, startW + (ev.clientX - startX) * 2)
    })
  }

  return (
    <div className={styles.root} data-testid="collage-canvas">
      {props.items.map((it) => {
        const p = props.positions[it.id]
        if (!p) return null
        const z = INTRA_CANVAS_Z_BASE + Math.max(0, props.order.indexOf(it.id))
        return (
          <div
            key={it.id}
            ref={(el): void => {
              refs.current[it.id] = el
            }}
            className={styles.element}
            data-testid={`collage-el-${it.id}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: `${p.w}px`,
              height: `${p.h}px`,
              transform: `translate(${p.x}px, ${p.y}px)`,
              zIndex: z,
            }}
            onPointerDown={(e): void => handleElementPointerDown(e, it.id)}
          >
            <CardNode id={it.id} title={it.title} thumbnailUrl={it.thumbnailUrl ?? undefined} />
            {/* Single corner is enough for basic-scope free resize (uniform
                scale via resizeElement's aspect-preserving height). */}
            <div
              className={styles.resizeCorner}
              data-testid={`collage-resize-${it.id}`}
              onPointerDown={(e): void => handleResizePointerDown(e, it.id)}
            />
          </div>
        )
      })}
    </div>
  )
}
