import { extractYoutubeId } from '@/lib/utils/url'

/** Thumbnail quality levels in fallback order. */
const THUMB_VARIANTS = ['maxresdefault', 'hqdefault', 'mqdefault', '0'] as const

/**
 * Returns YouTube thumbnail URL at the given fallback level.
 * @param url - YouTube watch / short / shorts URL
 * @param level - 0 = maxres (best), 1 = hq, 2 = mq, 3 = 0.jpg (always exists)
 * @returns Thumbnail URL, or null if URL is not a valid YouTube link
 */
export function getYoutubeThumb(url: string, level: 0 | 1 | 2 | 3): string | null {
  const id = extractYoutubeId(url)
  if (!id) return null
  return `https://i.ytimg.com/vi/${id}/${THUMB_VARIANTS[level]}.jpg`
}

/** True if URL is a YouTube Shorts link (vertical video). */
export function isYoutubeShortsUrl(url: string): boolean {
  return /youtube\.com\/shorts\//i.test(url)
}

/** The dimensions of the tiny generic placeholder i.ytimg.com serves — with a
 *  *decodable* JPEG body — when a quality level doesn't exist for a video.
 *  Confirmed via curl: `GET .../maxresdefault.jpg` on a video without a
 *  maxres thumbnail returns HTTP 404 but `Content-Type: image/jpeg`, a real
 *  120×90 JPEG body (1097 bytes). Browsers only fire <img onError> for
 *  responses that fail to decode as an image at all — a 404 with a valid
 *  image body still fires `load`, not `error` — so this silent gray
 *  placeholder is invisible to the naive onError-only retry chain. */
const PLACEHOLDER_WIDTH_PX = 120

/**
 * True when a loaded YouTube thumbnail is actually the CDN's ~120×90
 * placeholder rather than a real thumbnail for the requested level — the
 * signal callers need since `<img onError>` never fires for it (see
 * PLACEHOLDER_WIDTH_PX). Level 3 ('0.jpg', the last fallback) is exempt: its
 * real, always-available thumbnail genuinely IS 120×90, so a match there is
 * legitimate, not a failure. A width of 0 (image hasn't loaded yet) is never
 * flagged.
 * @param level - Which THUMB_VARIANTS level was just loaded (0-3)
 * @param naturalWidth - The loaded <img>'s naturalWidth
 */
export function isYoutubeThumbPlaceholder(level: 0 | 1 | 2 | 3, naturalWidth: number): boolean {
  if (level === 3) return false
  return naturalWidth > 0 && naturalWidth <= PLACEHOLDER_WIDTH_PX
}
