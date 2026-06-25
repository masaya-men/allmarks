'use client'

import { useMemo, type ReactElement } from 'react'
import { getBoardDecor } from '@/lib/board/board-decor'
import { paperAssetUrl } from '@/lib/board/paper-assets'

/**
 * The paper-atelier MIDDLE parallax layer: faint background stains / flourishes
 * scattered across the board content. Mounted only on the paper theme, between
 * the fixed parchment backdrop and the cards, inside a wrapper that BoardRoot
 * pans at a fraction of the card speed — so it parallaxes for depth.
 *
 * Strictly decorative: aria-hidden, pointer-events:none. Static images (no
 * per-frame paint); the only motion is the parent wrapper's scroll transform.
 */
export function BoardDecorLayer({
  scatterHeight,
}: {
  /** The vertical band (px) the slow-panned layer ever exposes through scroll —
   *  items scatter across THIS (not the full content height) so on-screen
   *  density stays uniform and no items are wasted below the visible band. */
  readonly scatterHeight: number
}): ReactElement {
  const items = useMemo(() => getBoardDecor(scatterHeight), [scatterHeight])

  return (
    <div
      aria-hidden="true"
      data-board-decor
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
    >
      {items.map((it, i) => {
        const url = paperAssetUrl(it.id)
        if (!url) return null
        return (
          <img
            key={i}
            src={url}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              left: `${it.xPct}%`,
              top: `${it.yPx}px`,
              width: `${it.widthPx}px`,
              height: 'auto',
              transform: `translate(-50%, -50%) rotate(${it.rotateDeg}deg)`,
              opacity: it.opacity,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          />
        )
      })}
    </div>
  )
}
