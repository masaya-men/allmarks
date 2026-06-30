/**
 * Single source of truth for which paper-atelier raster assets are CURRENTLY
 * placed under public/themes/paper-atelier/. Components consult this to decide
 * "use the real PNG" vs "fall back to the Plan 2 CSS/SVG look" (graceful
 * degradation — spec §2). Flip an entry to `true` the moment its <id>.png is
 * committed under public/themes/paper-atelier/.
 *
 * Keep this list in sync with the files on disk; the asset id IS the filename
 * stem (e.g. 'card-mat-1' -> /themes/paper-atelier/card-mat-1.png).
 */
export const PAPER_ASSET_BASE = '/themes/paper-atelier'

export type PaperAssetId =
  | 'parchment-bg'
  | 'card-mat-1' | 'card-mat-2' | 'card-mat-3' | 'card-mat-aged'
  // session 135 — ruled / graph paper mats (cut from master sheet section 2,
  // upscaled). Solid repeating textures that survive background-size:cover.
  | 'card-mat-lined' | 'card-mat-grid'
  // session 140 — real photographed vintage-paper mats (Figma Community
  // "60+ Free Vintage Paper Textures", CC BY 4.0). High-res replacements for
  // the earlier low-res generated mats, plus two extra variants for richer
  // per-card variety. All solid (no torn/deckle edge) so they survive cover.
  | 'card-mat-4' | 'card-mat-5'
  // session 142 — curated HIGH-RES mats cut from the user's Figma "60+ Free
  // Vintage Paper Textures" master sheet (9156×29860). The id suffix is the
  // tile number on that sheet so the source is traceable. Stored as JPEG
  // (photographic, no alpha) → ~1.2MB total vs ~19MB as PNG. These REPLACE the
  // earlier low-res mats in IMAGE_CARD_MAT_POOL.
  | 'card-mat-s5' | 'card-mat-s15' | 'card-mat-s17' | 'card-mat-s28'
  | 'card-mat-s32' | 'card-mat-s33' | 'card-mat-s35' | 'card-mat-s41' | 'card-mat-s52'
  | 'washi-tape-1' | 'washi-tape-2' | 'washi-tape-3' | 'washi-tape-4' | 'washi-tape-5'
  | 'push-pin-gold' | 'push-pin-green' | 'paper-clip'
  | 'photo-corner-1' | 'photo-corner-2' | 'photo-corner-3' | 'photo-corner-4'
  | 'stamp-circular' | 'stamp-rect' | 'stamp-oval'
  | 'wax-seal-a' | 'mk1-plate'
  | 'ruler-meter-strip' | 'ruler-meter-strip-2' | 'ruler-meter-strip-3'
  | 'ruler-meter-thumb' | 'ruler-meter-thumb-2'
  | 'deckle-edge-mat' | 'paper-foxing-overlay'
  // session 133 brushup 4 — richer parts (sheets 9/10)
  | 'washi-tape-6' | 'washi-tape-7' | 'washi-tape-8' | 'washi-tape-9'
  // session 140 — user-picked Scrapbook Diary Elements (CC BY 4.0). Clear
  // cellophane tapes (washi pool), an ink botanical sprig sealed with green
  // wax (scatter flourish), and a torn-kraft scrap (scatter accent).
  | 'washi-tape-10' | 'washi-tape-11'
  | 'decor-sprig-1' | 'decor-torn-kraft-1'
  // session 140 — text-card "paper style" backgrounds (ChatGPT kit, user-owned).
  // Used full-bleed (background-size:100% 100%) as the whole card for
  // thumbnail-less PlaceholderCards in the paper theme — graph sheet / spiral
  // notepad, with the title hand-written on top.
  | 'card-paper-graph' | 'card-paper-notepad'
  | 'stamp-archive' | 'stamp-confidential' | 'stamp-top-secret'
  | 'stamp-received' | 'stamp-classified' | 'stamp-confidential-red' | 'stamp-approved'
  | 'icon-star' | 'icon-heart' | 'icon-check' | 'icon-x' | 'icon-excl' | 'icon-question'
  | 'icon-search' | 'icon-bookmark' | 'icon-camera' | 'icon-envelope' | 'icon-eye' | 'icon-flag'
  | 'wax-seal-gold-a' | 'wax-seal-red'
  | 'parchment-bg-plain' | 'parchment-bg-frame' | 'parchment-outer'
  // middle parallax scatter layer (stains / flourishes)
  | 'decor-ring-1' | 'decor-ring-2' | 'decor-ring-coffee'
  | 'decor-flourish-1' | 'decor-flourish-2' | 'decor-flourish-3'
  // session 134 — dark aged-ink splat stains (generated, scripts/generate-paper-ink-splat.mjs)
  | 'ink-splat-1' | 'ink-splat-2' | 'ink-splat-3'

/** `true` = the PNG is committed and usable. `false` = not placed yet; the
 *  consuming face must degrade to its CSS/SVG fallback. */
export const PAPER_ASSETS: Readonly<Record<PaperAssetId, boolean>> = {
  'parchment-bg': true, // real aged-parchment backdrop (sheet 13_27, with coffee rings/specks)
  'parchment-bg-plain': true, 'parchment-bg-frame': true, 'parchment-outer': true,
  'decor-ring-1': true, 'decor-ring-2': true, 'decor-ring-coffee': true,
  'decor-flourish-1': true, 'decor-flourish-2': true, 'decor-flourish-3': true,
  'ink-splat-1': true, 'ink-splat-2': true, 'ink-splat-3': true,
  'card-mat-1': true, 'card-mat-2': true, 'card-mat-3': true, 'card-mat-aged': true,
  'card-mat-lined': true, 'card-mat-grid': true,
  'card-mat-4': true, 'card-mat-5': true,
  'card-mat-s5': true, 'card-mat-s15': true, 'card-mat-s17': true, 'card-mat-s28': true,
  'card-mat-s32': true, 'card-mat-s33': true, 'card-mat-s35': true, 'card-mat-s41': true, 'card-mat-s52': true,
  'washi-tape-1': true, 'washi-tape-2': true, 'washi-tape-3': true,
  'washi-tape-4': true, 'washi-tape-5': true,
  'push-pin-gold': true, 'push-pin-green': true, 'paper-clip': true,
  'photo-corner-1': true, 'photo-corner-2': true, 'photo-corner-3': true, 'photo-corner-4': true,
  'stamp-circular': true, 'stamp-rect': true, 'stamp-oval': true,
  'wax-seal-a': true, 'mk1-plate': true,
  'ruler-meter-strip': true, 'ruler-meter-strip-2': true, 'ruler-meter-strip-3': true,
  'ruler-meter-thumb': true, 'ruler-meter-thumb-2': true,
  'deckle-edge-mat': true, 'paper-foxing-overlay': true,
  'washi-tape-6': true, 'washi-tape-7': true, 'washi-tape-8': true, 'washi-tape-9': true,
  'washi-tape-10': true, 'washi-tape-11': true,
  'decor-sprig-1': true, 'decor-torn-kraft-1': true,
  'card-paper-graph': true, 'card-paper-notepad': true,
  'stamp-archive': true, 'stamp-confidential': true, 'stamp-top-secret': true,
  'stamp-received': true, 'stamp-classified': true, 'stamp-confidential-red': true, 'stamp-approved': true,
  'icon-star': true, 'icon-heart': true, 'icon-check': true, 'icon-x': true, 'icon-excl': true, 'icon-question': true,
  'icon-search': true, 'icon-bookmark': true, 'icon-camera': true, 'icon-envelope': true, 'icon-eye': true, 'icon-flag': true,
  'wax-seal-gold-a': true, 'wax-seal-red': true,
}

export function hasPaperAsset(id: PaperAssetId): boolean {
  return PAPER_ASSETS[id] === true
}

/** Asset ids stored as JPEG instead of PNG (photographic, no transparency
 *  needed — far smaller). Everything else is PNG. */
const JPEG_ASSETS: ReadonlySet<PaperAssetId> = new Set<PaperAssetId>([
  'card-mat-s5', 'card-mat-s15', 'card-mat-s17', 'card-mat-s28',
  'card-mat-s32', 'card-mat-s33', 'card-mat-s35', 'card-mat-s41', 'card-mat-s52',
])

export function paperAssetUrl(id: PaperAssetId): string | null {
  if (!hasPaperAsset(id)) return null
  const ext = JPEG_ASSETS.has(id) ? 'jpg' : 'png'
  return `${PAPER_ASSET_BASE}/${id}.${ext}`
}

/**
 * The mat backings a paper image card may pick from (N-13 ①). Single source of
 * truth so ImageCard.tsx (board) and ShareMirror.tsx (share replica) stay in
 * sync — both seed pickPaperAsset with the same card id over this exact pool,
 * so a card shows the SAME mat on the board and in its shared OG image.
 *
 * The 9 user-curated mats cut from the Figma "60+ Free Vintage Paper Textures"
 * master sheet (session 142). Genuinely high-res (~2000px native, served at
 * 1100px JPEG) — a mix the user picked of clean cream (s5/s17/s28/s32) and
 * crumpled / charactered papers (s33/s41/s52) plus a ribbed laid sheet (s15)
 * and a speckled tan (s35). All solid textures with no torn edge, so they
 * survive background-size:cover. Replaces the earlier low-res mats
 * (card-mat-1/2/3/aged blurred; card-mat-lined/grid were broken 380px crops).
 */
export const IMAGE_CARD_MAT_POOL: readonly PaperAssetId[] = [
  'card-mat-s5',
  'card-mat-s15',
  'card-mat-s17',
  'card-mat-s28',
  'card-mat-s32',
  'card-mat-s33',
  'card-mat-s35',
  'card-mat-s41',
  'card-mat-s52',
]

/**
 * Deterministically pick the asset to use from a candidate list, skipping any
 * not-yet-placed ids. `seedFraction` is a stable 0..1 number (e.g. derived
 * from card.id) so the same card always gets the same variant. Returns null
 * if NONE of the candidates are placed (caller then uses its CSS fallback).
 */
export function pickPaperAsset(
  seedFraction: number,
  ids: readonly PaperAssetId[],
): PaperAssetId | null {
  const placed = ids.filter(hasPaperAsset)
  if (placed.length === 0) return null
  const clamped = Math.max(0, Math.min(0.999999, seedFraction))
  return placed[Math.floor(clamped * placed.length)] ?? placed[0]
}
