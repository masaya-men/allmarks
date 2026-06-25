import type { ReactElement } from 'react'
import {
  getCardDecorations,
  type DecoCorner,
  type WashiPiece,
  type WashiEdge,
} from './paper-decorations'
import { paperAssetUrl, pickPaperAsset, type PaperAssetId } from '@/lib/board/paper-assets'
import styles from './PaperCardDecorations.module.css'

/**
 * Decorative, non-interactive paper overlay for a single board card.
 *
 * Mounts only on themes with `decorations: true` (paper-atelier). The set is
 * deterministic per `cardId`, so tape/pins/stamps never reshuffle between
 * renders. Strictly presentational: `aria-hidden`, pointer-events:none, and it
 * lives in the CardsLayer wrapper (outside the card's overflow clip) so it can
 * NOT affect hit-testing, the Lightbox FLIP origin rect, or card box geometry.
 *
 * Z-index: BOARD_Z_INDEX.CARD_DECORATION = 11 (above thumbnail, below
 * interactive chrome — resize handle z30, media indicator z50).
 */
export function PaperCardDecorations({
  cardId,
}: {
  /** Stable bookmark id used as the deterministic seed (CardNode data-card-id). */
  readonly cardId: string
}): ReactElement {
  const set = getCardDecorations(cardId)

  return (
    <div className={styles.overlay} aria-hidden="true" data-testid="paper-card-decorations">
      {set.photoCorners.map((c) => {
        const idx = ({ tl: 1, tr: 2, br: 3, bl: 4 } as const)[c]
        const assetId: PaperAssetId = `photo-corner-${idx}`
        const url = paperAssetUrl(assetId)
        return (
          <span
            key={`pc-${c}`}
            data-deco="photo-corner"
            data-asset={url ? 'true' : undefined}
            className={cornerClass(c)}
            style={{ backgroundImage: bg(url) }}
          />
        )
      })}

      {set.washi.map((w, i) => {
        const id = pickPaperAsset(w.assetSeed, [
          'washi-tape-1', 'washi-tape-2', 'washi-tape-3', 'washi-tape-4', 'washi-tape-5',
        ])
        return (
          <span
            key={`washi-${i}`}
            data-deco="washi"
            data-asset={id ? 'true' : undefined}
            className={washiClass(w)}
            style={{ ...washiStyle(w), backgroundImage: bg(id ? paperAssetUrl(id) : null) }}
          />
        )
      })}

      {set.pin && (() => {
        const pinId: PaperAssetId = set.pin.variant === 'gold' ? 'push-pin-gold' : 'push-pin-green'
        const hasAsset = Boolean(paperAssetUrl(pinId))
        return (
          <span
            data-deco="pin"
            data-asset={hasAsset ? 'true' : undefined}
            className={styles.pin}
            style={{ backgroundImage: bg(paperAssetUrl(pinId)) }}
          />
        )
      })()}

      {set.clip && (() => {
        const hasAsset = Boolean(paperAssetUrl('paper-clip'))
        return (
          <span
            data-deco="clip"
            data-asset={hasAsset ? 'true' : undefined}
            className={styles.clip}
            style={{ backgroundImage: bg(paperAssetUrl('paper-clip')) }}
          />
        )
      })()}

      {set.stamp && (() => {
        const id = pickPaperAsset(set.stamp!.assetSeed, ['stamp-circular', 'stamp-rect', 'stamp-oval'])
        return (
          <span
            data-deco="stamp"
            data-asset={id ? 'true' : undefined}
            className={`${styles.stamp} ${stampCornerClass(set.stamp!.corner)}`}
            style={{ transform: `rotate(${set.stamp!.angleDeg}deg)`, backgroundImage: bg(id ? paperAssetUrl(id) : null) }}
          >
            {set.stamp!.label}
          </span>
        )
      })()}
    </div>
  )
}

/** Convert a URL string (or null) to a CSS background-image value. */
function bg(url: string | null): string | undefined {
  return url ? `url("${url}")` : undefined
}

function cornerClass(c: DecoCorner): string {
  switch (c) {
    case 'tl':
      return `${styles.photoCorner} ${styles.photoCornerTl}`
    case 'tr':
      return `${styles.photoCorner} ${styles.photoCornerTr}`
    case 'bl':
      return `${styles.photoCorner} ${styles.photoCornerBl}`
    case 'br':
      return `${styles.photoCorner} ${styles.photoCornerBr}`
  }
}

function stampCornerClass(c: DecoCorner): string {
  switch (c) {
    case 'tl':
      return styles.stampTl
    case 'tr':
      return styles.stampTr
    case 'bl':
      return styles.stampBl
    case 'br':
      return styles.stampBr
  }
}

function washiClass(w: WashiPiece): string {
  const tint =
    w.tint === 'a' ? styles.washiTintA : w.tint === 'b' ? styles.washiTintB : styles.washiTintC
  return `${styles.washi} ${tint} ${edgeClass(w.edge)}`
}

function edgeClass(edge: WashiEdge): string {
  switch (edge) {
    case 'top':
      return styles.washiTop
    case 'bottom':
      return styles.washiBottom
    case 'left':
      return styles.washiLeft
    case 'right':
      return styles.washiRight
  }
}

function washiStyle(w: WashiPiece): Readonly<{ transform: string; left?: string; top?: string }> {
  // top/bottom strips slide horizontally; left/right strips slide vertically.
  if (w.edge === 'top' || w.edge === 'bottom') {
    return { left: `${w.offsetPct}%`, transform: `translateX(-50%) rotate(${w.angleDeg}deg)` }
  }
  return { top: `${w.offsetPct}%`, transform: `translateY(-50%) rotate(${w.angleDeg + 90}deg)` }
}
