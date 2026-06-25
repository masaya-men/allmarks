/**
 * Deterministic scatter for the paper-atelier MIDDLE parallax layer — faint
 * background "stains, pins and small items" (coffee/ink rings, gold flourishes,
 * the odd wax seal) strewn across the board content. This layer scrolls at a
 * fraction of the card speed (see BoardRoot), so it parallaxes between the
 * fixed parchment backdrop (0x) and the cards (1x) for a real depth read.
 *
 * Pure + seeded (mulberry32 over a fixed string) so the scatter is stable
 * across renders/reloads. Presentational only: the layer is pointer-events:none.
 */
import { type PaperAssetId } from './paper-assets'

export type BoardDecorItem = {
  readonly id: PaperAssetId
  /** Horizontal center, 0..100 (% of content width). */
  readonly xPct: number
  /** Vertical center, absolute px within the content height. */
  readonly yPx: number
  /** Rendered width in px (height auto). */
  readonly widthPx: number
  readonly rotateDeg: number
  readonly opacity: number
}

/** Scatter pool — rings read as stains; flourishes as faint ink lines; a rare
 *  wax seal as a small accent. */
const DECOR_POOL: readonly PaperAssetId[] = [
  'decor-ring-1', 'decor-ring-2', 'decor-ring-coffee',
  'decor-flourish-1', 'decor-flourish-2', 'decor-flourish-3',
  'wax-seal-red',
]

/** ~one scattered item per this many px of content height. */
const ROW_SPACING_PX = 540

function mulberry32(seed: number): () => number {
  let s = seed
  return (): number => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashStringToSeed(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Deterministic scatter for a board of the given content height. More items for
 * taller boards; stable for a given height (same seed string).
 */
export function getBoardDecor(contentHeight: number): BoardDecorItem[] {
  if (!Number.isFinite(contentHeight) || contentHeight <= 0) return []
  const rng = mulberry32(hashStringToSeed('allmarks-board-decor-v1'))
  const rows = Math.max(0, Math.floor(contentHeight / ROW_SPACING_PX))
  const items: BoardDecorItem[] = []
  for (let i = 0; i < rows; i++) {
    const id = DECOR_POOL[Math.floor(rng() * DECOR_POOL.length)] as PaperAssetId
    // jittered vertical band so items don't sit on an even grid
    const band = (i + rng()) / Math.max(1, rows)
    const isFlourish = id.startsWith('decor-flourish')
    items.push({
      id,
      xPct: Math.round((6 + rng() * 88) * 10) / 10,
      yPx: Math.floor(band * contentHeight),
      widthPx: isFlourish ? Math.round(140 + rng() * 160) : Math.round(90 + rng() * 110),
      rotateDeg: Math.round((rng() - 0.5) * 30 * 10) / 10,
      opacity: Math.round((0.45 + rng() * 0.35) * 100) / 100,
    })
  }
  return items
}
