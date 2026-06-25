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

/** Scatter categories. Each item rolls a category first (weighted), then an id
 *  + size/opacity range for that category, so stains stay large and faint while
 *  accents stay small and a touch crisper — a believable atelier wash rather
 *  than a uniform field. Ids are all PLACED assets (paper-assets manifest). */
type DecorCategory = {
  readonly ids: readonly PaperAssetId[]
  /** relative draw weight */
  readonly weight: number
  /** [min, max] rendered width px */
  readonly width: readonly [number, number]
  /** [min, max] opacity */
  readonly opacity: readonly [number, number]
  /** max absolute rotation (deg) */
  readonly rotate: number
}

const DECOR_CATEGORIES: readonly DecorCategory[] = [
  // DARK aged-ink splat stains — the parallax-CARRYING marks. SMALL: scattered
  // ink specks, not big blobs (user: the stains were too big, shrink to ~1/8).
  // Kept the dominant category + decent opacity so the slow pan is still felt.
  { ids: ['ink-splat-1', 'ink-splat-2', 'ink-splat-3'], weight: 7, width: [30, 76], opacity: [0.5, 0.74], rotate: 60 },
  // gold coffee/ink rings → small secondary stains.
  { ids: ['decor-ring-1', 'decor-ring-2', 'decor-ring-coffee'], weight: 3, width: [56, 130], opacity: [0.4, 0.6], rotate: 40 },
  // flourishes → faint short ink lines drifting across the sheet.
  { ids: ['decor-flourish-1', 'decor-flourish-2', 'decor-flourish-3'], weight: 2, width: [80, 180], opacity: [0.32, 0.5], rotate: 28 },
  // small accents — wax seals + icon stamps. NO word/text stamps (ARCHIVE etc.):
  // on a card they get mistaken for tags, and even loose they read as labels.
  {
    ids: [
      'wax-seal-red', 'wax-seal-a',
      'icon-star', 'icon-eye', 'icon-flag', 'icon-bookmark', 'icon-heart',
    ],
    weight: 2, width: [40, 86], opacity: [0.4, 0.6], rotate: 44,
  },
]

const TOTAL_WEIGHT = DECOR_CATEGORIES.reduce((s, c) => s + c.weight, 0)

/** Vertical band size; each band scatters ITEMS_PER_BAND items across the full
 *  width, so the effective density is ~one item per (ROW_SPACING_PX / avg
 *  items) px. */
const ROW_SPACING_PX = 190
const ITEMS_PER_BAND_MIN = 2
const ITEMS_PER_BAND_MAX = 4
/** One self-contained scatter TILE is generated for this height, then repeated
 *  (LOOPED) down the whole band so the scatter NEVER runs out partway — items
 *  used to stop once MAX_ITEMS was hit, leaving the lower board bare. Alternate
 *  tiles are x-mirrored + rotation-shifted to mask the repeat. */
const TILE_HEIGHT_PX = 1500
/** Safety cap so very tall boards can't spawn an unbounded scatter (4K
 *  fill-rate watch — items are small now, but more = more composited tiles). */
const MAX_ITEMS = 220

function rangeAt(rng: () => number, [min, max]: readonly [number, number]): number {
  return min + rng() * (max - min)
}

function pickCategory(rng: () => number): DecorCategory {
  let r = rng() * TOTAL_WEIGHT
  for (const c of DECOR_CATEGORIES) {
    r -= c.weight
    if (r <= 0) return c
  }
  return DECOR_CATEGORIES[0] as DecorCategory
}

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

/** Build ONE deterministic scatter tile (items with yPx in [0, TILE_HEIGHT_PX)). */
function buildTile(rng: () => number): BoardDecorItem[] {
  const tile: BoardDecorItem[] = []
  const rows = Math.max(1, Math.floor(TILE_HEIGHT_PX / ROW_SPACING_PX))
  for (let i = 0; i < rows; i++) {
    const perBand =
      ITEMS_PER_BAND_MIN + Math.floor(rng() * (ITEMS_PER_BAND_MAX - ITEMS_PER_BAND_MIN + 1))
    for (let j = 0; j < perBand; j++) {
      const cat = pickCategory(rng)
      const id = cat.ids[Math.floor(rng() * cat.ids.length)] as PaperAssetId
      const band = (i + rng()) / rows // jittered so items never sit on a grid
      tile.push({
        id,
        xPct: Math.round((4 + rng() * 92) * 10) / 10,
        yPx: Math.floor(band * TILE_HEIGHT_PX),
        widthPx: Math.round(rangeAt(rng, cat.width)),
        rotateDeg: Math.round((rng() - 0.5) * 2 * cat.rotate * 10) / 10,
        opacity: Math.round(rangeAt(rng, cat.opacity) * 100) / 100,
      })
    }
  }
  return tile
}

/**
 * Deterministic scatter across `scatterHeight` px (the vertical band the slow
 * parallax pan actually exposes — see BoardRoot DECOR_PARALLAX_FACTOR). A single
 * TILE pattern is repeated down the band so the scatter is uniform and NEVER
 * runs out partway (alternate tiles are x-mirrored + rotation-shifted to mask
 * the repeat). Stable for a given height (same seed string).
 */
export function getBoardDecor(scatterHeight: number): BoardDecorItem[] {
  if (!Number.isFinite(scatterHeight) || scatterHeight <= 0) return []
  const rng = mulberry32(hashStringToSeed('allmarks-board-decor-v4'))
  const tile = buildTile(rng)
  const items: BoardDecorItem[] = []
  const tiles = Math.max(1, Math.ceil(scatterHeight / TILE_HEIGHT_PX))
  for (let t = 0; t < tiles && items.length < MAX_ITEMS; t++) {
    const mirror = t % 2 === 1
    const rotShift = mirror ? 17 : -11
    for (const base of tile) {
      if (items.length >= MAX_ITEMS) break
      const yPx = base.yPx + t * TILE_HEIGHT_PX
      if (yPx > scatterHeight) continue
      items.push({
        ...base,
        yPx,
        xPct: mirror ? Math.round((100 - base.xPct) * 10) / 10 : base.xPct,
        rotateDeg: Math.round((base.rotateDeg + rotShift) * 10) / 10,
      })
    }
  }
  return items
}
