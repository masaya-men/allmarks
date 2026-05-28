import { describe, it, expect } from 'vitest'
import { resolveTweetVideoExtraction } from '@/lib/board/tweet-video-extraction'
import type { BoardItem } from '@/lib/storage/use-board-data'
import type { MediaSlot } from '@/lib/embed/types'

/** Minimal BoardItem for the gate — it only reads url / hasVideo / mediaSlots /
 *  bookmarkId, so the rest is filler. */
function item(p: {
  bookmarkId?: string
  url: string
  hasVideo?: boolean
  mediaSlots?: readonly MediaSlot[]
}): BoardItem {
  return {
    bookmarkId: p.bookmarkId ?? 'bm',
    url: p.url,
    hasVideo: p.hasVideo,
    mediaSlots: p.mediaSlots,
  } as unknown as BoardItem
}

describe('resolveTweetVideoExtraction (mixed-media skip gate)', () => {
  // Shape taken from a REAL mixed-media tweet in the user's backup
  // (x.com/men_masaya/status/1842217368673759498 — video + 2 photos).
  it('SKIPS extraction for a real mixed-media tweet (video + photos) → undefined', () => {
    const result = resolveTweetVideoExtraction(
      item({
        bookmarkId: '057b1595',
        url: 'https://x.com/men_masaya/status/1842217368673759498',
        hasVideo: true,
        mediaSlots: [
          { type: 'video', url: 'https://poster.jpg', videoUrl: 'https://video.twimg.com/ext_tw_video/1842217102645882880/pu/vid/avc1/720x1008/Xzj_lp2Bo3dPBmFn.mp4?tag=12' },
          { type: 'photo', url: 'https://p1.jpg' },
          { type: 'photo', url: 'https://p2.jpg' },
        ],
      }),
    )
    expect(result).toBeUndefined()
  })

  it('EXTRACTS for a video-only tweet (no photos) → returns the mp4 source', () => {
    const result = resolveTweetVideoExtraction(
      item({
        bookmarkId: 'vidonly',
        url: 'https://x.com/u/status/2057654178671960283',
        hasVideo: true,
        mediaSlots: [
          { type: 'video', url: 'https://poster.jpg', videoUrl: 'https://video.twimg.com/amplify_video/x/vid/avc1/1920x1080/abc.mp4' },
        ],
      }),
    )
    expect(result).toEqual({
      bookmarkId: 'vidonly',
      videoUrl: 'https://video.twimg.com/amplify_video/x/vid/avc1/1920x1080/abc.mp4',
    })
  })

  it('skips a photo-only tweet (hasVideo false) → undefined', () => {
    expect(
      resolveTweetVideoExtraction(
        item({
          url: 'https://x.com/u/status/1',
          hasVideo: false,
          mediaSlots: [{ type: 'photo', url: 'https://p1.jpg' }],
        }),
      ),
    ).toBeUndefined()
  })

  it('skips non-tweet cards (e.g. YouTube) → undefined', () => {
    expect(
      resolveTweetVideoExtraction(
        item({ url: 'https://www.youtube.com/watch?v=abc', hasVideo: true }),
      ),
    ).toBeUndefined()
  })

  it('skips a video tweet whose mediaSlots have no usable mp4 → undefined', () => {
    expect(
      resolveTweetVideoExtraction(
        item({
          url: 'https://x.com/u/status/1',
          hasVideo: true,
          mediaSlots: [{ type: 'video', url: 'https://poster.jpg' }], // no videoUrl
        }),
      ),
    ).toBeUndefined()
  })
})
