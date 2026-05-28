import { detectUrlType, extractYoutubeId } from '@/lib/utils/url'
import type { PlayableItem } from '@/components/board/embeds/media-players'

/** One still in a card's ambient slideshow. `fallback` is tried once if `src`
 *  fails to load — YouTube's hi-res storyboard frames (hq1/hq2) 404 on a
 *  minority of videos, but the low-res (1/2) version almost always exists. */
export type SlideshowFrame = { readonly src: string; readonly fallback?: string }

/** Resolve the ordered still frames for a video card's ambient slideshow.
 *  - YouTube: poster + ~25% (hq1) + ~50% (hq2) storyboard stills. Zero decode
 *    (plain images from i.ytimg.com). Deliberately skips the ~75% (hq3) frame
 *    so the cycle never lands on a dark end-of-video frame.
 *  - Everything else (Vimeo, X-video in Phase 1, generic): the single poster.
 *  Returns [] when there's no usable image. Pure — unit tested. */
export function resolveSlideshowFrames(item: PlayableItem): readonly SlideshowFrame[] {
  // Mixed-media (X video + still photos): cycle the tweet's OWN photos and
  // append the video poster, so a video+photo card gets a real multi-frame
  // ambient slideshow WITHOUT running the canvas video-frame extractor (= video
  // decode + canvas + JPEG, all skipped). The matching extraction skip lives in
  // CardsLayer's resolveTweetVideoExtraction. Ported from the LoPo housing cards.
  const photoSlots = item.mediaSlots?.filter((s) => s.type === 'photo') ?? []
  if (photoSlots.length > 0) {
    const frames: SlideshowFrame[] = photoSlots.map((s) => ({ src: s.url }))
    const posterUrl = item.mediaSlots?.find((s) => s.type === 'video')?.url
    if (posterUrl) frames.push({ src: posterUrl })
    return frames
  }
  if (detectUrlType(item.url) === 'youtube') {
    const id = extractYoutubeId(item.url)
    if (id) {
      const base = `https://i.ytimg.com/vi/${id}`
      return [
        { src: item.thumbnail || `${base}/hqdefault.jpg` },
        { src: `${base}/hq1.jpg`, fallback: `${base}/1.jpg` },
        { src: `${base}/hq2.jpg`, fallback: `${base}/2.jpg` },
      ]
    }
  }
  return item.thumbnail ? [{ src: item.thumbnail }] : []
}
