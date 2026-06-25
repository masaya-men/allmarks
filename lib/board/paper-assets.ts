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
  | 'ruler-meter-strip' | 'ruler-meter-strip-2'
  | 'ruler-meter-thumb' | 'ruler-meter-thumb-2'
  | 'deckle-edge-mat' | 'paper-foxing-overlay'

/** `true` = the PNG is committed and usable. `false` = not placed yet; the
 *  consuming face must degrade to its CSS/SVG fallback. */
export const PAPER_ASSETS: Readonly<Record<PaperAssetId, boolean>> = {
  'parchment-bg': false, // pending final slice (Task 2)
  'card-mat-1': true, 'card-mat-2': true, 'card-mat-3': true, 'card-mat-aged': true,
  'washi-tape-1': true, 'washi-tape-2': true, 'washi-tape-3': true,
  'washi-tape-4': true, 'washi-tape-5': true,
  'push-pin-gold': true, 'push-pin-green': true, 'paper-clip': true,
  'photo-corner-1': true, 'photo-corner-2': true, 'photo-corner-3': true, 'photo-corner-4': true,
  'stamp-circular': true, 'stamp-rect': true, 'stamp-oval': true,
  'wax-seal-a': true, 'mk1-plate': true,
  'ruler-meter-strip': true, 'ruler-meter-strip-2': true,
  'ruler-meter-thumb': true, 'ruler-meter-thumb-2': true,
  'deckle-edge-mat': true, 'paper-foxing-overlay': true,
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
