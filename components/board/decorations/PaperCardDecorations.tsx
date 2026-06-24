import type { ReactElement } from 'react'
import {
  getCardDecorations,
  type DecoCorner,
  type WashiPiece,
  type WashiEdge,
} from './paper-decorations'
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
    <div className={styles.overlay} aria-hidden="true">
      {set.photoCorners.map((c) => (
        <span key={`pc-${c}`} data-deco="photo-corner" className={cornerClass(c)} />
      ))}

      {set.washi.map((w, i) => (
        <span
          key={`washi-${i}`}
          data-deco="washi"
          className={washiClass(w)}
          style={washiStyle(w)}
        />
      ))}

      {set.pin && <span data-deco="pin" className={styles.pin} />}
      {set.clip && <span data-deco="clip" className={styles.clip} />}

      {set.stamp && (
        <span
          data-deco="stamp"
          className={`${styles.stamp} ${stampCornerClass(set.stamp.corner)}`}
          style={{ transform: `rotate(${set.stamp.angleDeg}deg)` }}
        >
          {set.stamp.label}
        </span>
      )}
    </div>
  )
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
