import { pickPlaceholderImage } from '@/lib/board/placeholder-image'

/**
 * Display thumbnail for a PiP card: the real thumbnail when present, otherwise
 * the same deterministic placeholder image the board uses for no-image cards
 * (`pickPlaceholderImage`). This keeps the PiP card and the board card showing
 * the same artwork for a bookmark that has no og:image (the PiP card's CSS
 * generic fallback otherwise diverges from the board's placeholder image).
 *
 * @param thumbnail - The resolved thumbnail URL (may be empty)
 * @param url - The bookmark URL, used to pick a stable placeholder
 * @returns The thumbnail to render, or '' only if no placeholder is registered
 */
export function pipDisplayThumbnail(thumbnail: string, url: string): string {
  if (thumbnail !== '') return thumbnail
  return pickPlaceholderImage(url)?.url ?? ''
}
