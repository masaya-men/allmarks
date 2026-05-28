import { detectUrlType } from '@/lib/utils/url'
import type { BoardItem } from '@/lib/storage/use-board-data'

/** A request for the ambient slideshow to swap its poster fallback for 3
 *  canvas-extracted video frames once the extractor finishes. */
export type TweetVideoExtraction = {
  readonly bookmarkId: string
  readonly videoUrl: string
}

/**
 * Decide whether an X (Twitter) video card should run the canvas frame
 * extractor for its ambient slideshow. Returns the extraction request, or
 * `undefined` to SKIP it.
 *
 * Skipped when:
 *  - not a tweet, or the tweet has no video
 *  - the tweet ALSO carries still photos (mixed-media): the ambient slideshow
 *    builds real frames from those photos (+ the video poster) via
 *    resolveSlideshowFrames, so extraction (video decode + canvas + JPEG) would
 *    be pure wasted cost. Video-ONLY tweets fall through and still extract.
 *  - no resolvable mp4 source in mediaSlots
 *
 * The hero spotlight plays the real video through a SEPARATE path and is
 * unaffected by this decision. Mixed-media skip ported from the LoPo housing
 * cards (`useHousingCardFrames`: shouldExtract = videoUrl && !hasSourceImages).
 */
export function resolveTweetVideoExtraction(item: BoardItem): TweetVideoExtraction | undefined {
  if (detectUrlType(item.url) !== 'tweet' || item.hasVideo !== true) return undefined
  const hasSourceImages = item.mediaSlots?.some((s) => s.type === 'photo') ?? false
  if (hasSourceImages) return undefined
  const videoUrl = item.mediaSlots?.find((s) => s.type === 'video' && s.videoUrl)?.videoUrl
  if (!videoUrl) return undefined
  return { bookmarkId: item.bookmarkId, videoUrl }
}
