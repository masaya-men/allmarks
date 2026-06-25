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
  | 'stamp-archive' | 'stamp-confidential' | 'stamp-top-secret'
  | 'stamp-received' | 'stamp-classified' | 'stamp-confidential-red' | 'stamp-approved'
  | 'icon-star' | 'icon-heart' | 'icon-check' | 'icon-x' | 'icon-excl' | 'icon-question'
  | 'icon-search' | 'icon-bookmark' | 'icon-camera' | 'icon-envelope' | 'icon-eye' | 'icon-flag'
  | 'wax-seal-gold-a' | 'wax-seal-red'
  | 'parchment-bg-plain' | 'parchment-bg-frame' | 'parchment-outer'
  // middle parallax scatter layer (stains / flourishes)
  | 'decor-ring-1' | 'decor-ring-2' | 'decor-ring-coffee'
  | 'decor-flourish-1' | 'decor-flourish-2' | 'decor-flourish-3'

/** `true` = the PNG is committed and usable. `false` = not placed yet; the
 *  consuming face must degrade to its CSS/SVG fallback. */
export const PAPER_ASSETS: Readonly<Record<PaperAssetId, boolean>> = {
  'parchment-bg': true, // real aged-parchment backdrop (sheet 13_27, with coffee rings/specks)
  'parchment-bg-plain': true, 'parchment-bg-frame': true, 'parchment-outer': true,
  'decor-ring-1': true, 'decor-ring-2': true, 'decor-ring-coffee': true,
  'decor-flourish-1': true, 'decor-flourish-2': true, 'decor-flourish-3': true,
  'card-mat-1': true, 'card-mat-2': true, 'card-mat-3': true, 'card-mat-aged': true,
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
  'stamp-archive': true, 'stamp-confidential': true, 'stamp-top-secret': true,
  'stamp-received': true, 'stamp-classified': true, 'stamp-confidential-red': true, 'stamp-approved': true,
  'icon-star': true, 'icon-heart': true, 'icon-check': true, 'icon-x': true, 'icon-excl': true, 'icon-question': true,
  'icon-search': true, 'icon-bookmark': true, 'icon-camera': true, 'icon-envelope': true, 'icon-eye': true, 'icon-flag': true,
  'wax-seal-gold-a': true, 'wax-seal-red': true,
}

export function hasPaperAsset(id: PaperAssetId): boolean {
  return PAPER_ASSETS[id] === true
}

export function paperAssetUrl(id: PaperAssetId): string | null {
  return hasPaperAsset(id) ? `${PAPER_ASSET_BASE}/${id}.png` : null
}

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
