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
  tornBacking = false,
}: {
  /** Stable bookmark id used as the deterministic seed (CardNode data-card-id). */
  readonly cardId: string
  /** True when the card's backing is a torn-paper sheet (graph / notepad). Photo
   *  corners anchor to the rectangular card-box corners, which on a torn sheet
   *  fall on the torn-away zone and float detached — so they're suppressed here.
   *  Edge/center decorations (washi, pin, clip) are unaffected: tape over a torn
   *  edge reads fine. Other decoration rolls are untouched (no reshuffle). */
  readonly tornBacking?: boolean
}): ReactElement {
  const set = getCardDecorations(cardId)
  // On torn-paper sheets the four box corners aren't where the paper corner is,
  // so a corner holder sits on empty board → drop them for these cards only.
  const photoCorners = tornBacking ? [] : set.photoCorners

  return (
    <div className={styles.overlay} aria-hidden="true" data-testid="paper-card-decorations">
      {photoCorners.map((c) => {
        // Use ONE corner asset (photo-corner-1 = top-left pocket) and rotate it
        // to each corner. This guarantees the pocket always points the right way
        // — the 4 source PNGs aren't reliably ordered tl/tr/br/bl, so mapping by
        // index produced mis-oriented corners.
        const url = paperAssetUrl('photo-corner-1')
        const rot = ({ tl: 0, tr: 90, br: 180, bl: 270 } as const)[c]
        return (
          <span
            key={`pc-${c}`}
            data-deco="photo-corner"
            data-asset={url ? 'true' : undefined}
            className={cornerClass(c)}
            style={{ backgroundImage: bg(url), transform: url ? `rotate(${rot}deg)` : undefined }}
          />
        )
      })}

      {set.washi.map((w, i) => {
        const id = pickPaperAsset(w.assetSeed, [
          'washi-tape-1', 'washi-tape-2', 'washi-tape-3', 'washi-tape-4', 'washi-tape-5',
          'washi-tape-6', 'washi-tape-7', 'washi-tape-8', 'washi-tape-9',
          // session 140 — clear cellophane tapes (user pick)
          'washi-tape-10', 'washi-tape-11',
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
        const s = set.stamp
        const id = pickPaperAsset(s.assetSeed, STAMP_IDS)
        return (
          <span
            data-deco="stamp"
            data-asset={id ? 'true' : undefined}
            className={`${styles.stamp} ${stampCornerClass(s.corner)}`}
            style={{ transform: `rotate(${s.angleDeg}deg)`, backgroundImage: bg(id ? paperAssetUrl(id) : null) }}
          />
        )
      })()}

      {set.iconStamp && (() => {
        const ic = set.iconStamp
        const id = pickPaperAsset(ic.assetSeed, ICON_IDS)
        return (
          <span
            data-deco="icon"
            data-asset={id ? 'true' : undefined}
            className={`${styles.iconStamp} ${stampCornerClass(ic.corner)}`}
            style={{ transform: `rotate(${ic.angleDeg}deg)`, backgroundImage: bg(id ? paperAssetUrl(id) : null) }}
          />
        )
      })()}

      {set.wax && (() => {
        const id = pickPaperAsset(set.wax.assetSeed, ['wax-seal-red'])
        return (
          <span
            data-deco="wax"
            data-asset={id ? 'true' : undefined}
            className={`${styles.waxDeco} ${stampCornerClass(set.wax.corner)}`}
            style={{ backgroundImage: bg(id ? paperAssetUrl(id) : null) }}
          />
        )
      })()}
    </div>
  )
}

/** Word-stamp PNG pool (the word is baked into the art). */
const STAMP_IDS: readonly PaperAssetId[] = [
  'stamp-archive', 'stamp-confidential', 'stamp-top-secret',
  'stamp-received', 'stamp-classified', 'stamp-confidential-red', 'stamp-approved',
]

/** Icon-stamp PNG pool. */
const ICON_IDS: readonly PaperAssetId[] = [
  'icon-star', 'icon-heart', 'icon-check', 'icon-x', 'icon-excl', 'icon-question',
  'icon-search', 'icon-bookmark', 'icon-camera', 'icon-envelope', 'icon-eye', 'icon-flag',
]

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
