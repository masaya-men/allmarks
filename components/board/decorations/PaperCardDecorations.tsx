import { memo, type CSSProperties, type ReactElement } from 'react'
import {
  resolveDecorations,
  type DecoCorner,
  type TapeFamily,
  type TapePiece,
} from './paper-decorations'
import { paperAssetUrl, pickPaperAsset, type PaperAssetId } from '@/lib/board/paper-assets'
import styles from './PaperCardDecorations.module.css'

/**
 * Decorative, non-interactive paper overlay for a single board card.
 *
 * Mounts only on themes with `decorations: true` (paper-atelier). The set is
 * deterministic per (cardId, tornBacking), so the tape/pin never reshuffle
 * between renders. Strictly presentational: `aria-hidden`, pointer-events:none,
 * and it lives in the CardsLayer wrapper (outside the card's overflow clip) so it
 * can NOT affect hit-testing, the Lightbox FLIP origin rect, or card box geometry.
 *
 * Z-index: BOARD_Z_INDEX.CARD_DECORATION = 11 (above thumbnail, below
 * interactive chrome — resize handle z30, media indicator z50).
 */
// memo: the resolved set is deterministic per (cardId, tornBacking), both
// primitives, so the default shallow compare skips re-renders. Without this the
// overlay re-rendered for EVERY card on EVERY board re-render — notably each
// pointer step of a drag-reorder, which is where it hurt.
export const PaperCardDecorations = memo(function PaperCardDecorations({
  cardId,
  tornBacking = false,
  scale = 1,
}: {
  /** Stable bookmark id used as the deterministic seed (CardNode data-card-id). */
  readonly cardId: string
  /** True when the card's backing is a torn-paper / ring-bound sheet (graph /
   *  notepad). A push-pin becomes a top-center tape (see resolveDecorations). */
  readonly tornBacking?: boolean
  /** Uniform size multiplier for every decoration (tape/pin/wax/icon/anchor
   *  offsets). 1 on the board (default → no inline style, board byte-identical);
   *  the SHARE collage passes its fit scale so decorations shrink WITH the shrunk
   *  cards. Consumed as the --deco-scale CSS var in the module stylesheet. */
  readonly scale?: number
}): ReactElement {
  const set = resolveDecorations(cardId, tornBacking)

  return (
    <div
      className={styles.overlay}
      aria-hidden="true"
      data-testid="paper-card-decorations"
      // Only emit the var when scaling (collage); scale 1 leaves the board DOM
      // untouched. calc() in the module falls back to 1 when the var is absent.
      style={scale === 1 ? undefined : ({ '--deco-scale': scale } as CSSProperties)}
    >
      {set.tape && (() => {
        const t = set.tape
        const id = pickPaperAsset(t.assetSeed, set.tapeFamily === 'clear' ? CLEAR_TAPE_IDS : COLORED_TAPE_IDS)
        return (
          <span
            data-deco="tape"
            data-tape-family={set.tapeFamily}
            data-asset={id ? 'true' : undefined}
            className={tapeClass(set.tapeFamily)}
            style={{ ...tapeStyle(t), backgroundImage: bg(id ? paperAssetUrl(id) : null) }}
          />
        )
      })()}

      {set.pin && (() => {
        const pinId: PaperAssetId = set.pinVariant === 'gold' ? 'push-pin-gold' : 'push-pin-green'
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
})

/** Coloured washi tape PNG pool. washi-tape-8 is intentionally excluded — its
 *  usable band is only ~46% of the PNG height (a red scrap artifact stretches the
 *  bbox), so it renders as a too-thin, half-baked strip. */
const COLORED_TAPE_IDS: readonly PaperAssetId[] = [
  'washi-tape-1', 'washi-tape-2', 'washi-tape-3', 'washi-tape-4', 'washi-tape-5',
  'washi-tape-6', 'washi-tape-7', 'washi-tape-9',
]

/** Clear cellophane tape PNG pool. */
const CLEAR_TAPE_IDS: readonly PaperAssetId[] = ['washi-tape-10', 'washi-tape-11']

/** Icon-stamp PNG pool. */
const ICON_IDS: readonly PaperAssetId[] = [
  'icon-star', 'icon-heart', 'icon-check', 'icon-x', 'icon-excl', 'icon-question',
  'icon-search', 'icon-bookmark', 'icon-camera', 'icon-envelope', 'icon-eye', 'icon-flag',
]

/** Convert a URL string (or null) to a CSS background-image value. */
function bg(url: string | null): string | undefined {
  return url ? `url("${url}")` : undefined
}

function tapeClass(family: TapeFamily): string {
  const paint = family === 'clear' ? styles.tapeClear : styles.tapeColored
  return `${styles.tape} ${paint} ${styles.tapeEdgeTop}`
}

/** Top-center strip: `left` from the piece offset, translate centres it on the
 *  top edge line so its upper half overhangs onto the board. */
function tapeStyle(t: TapePiece): CSSProperties {
  return { left: `${t.offsetPct}%`, transform: `translate(-50%, -50%) rotate(${t.angleDeg}deg)` }
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
