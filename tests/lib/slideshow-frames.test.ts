import { describe, it, expect } from 'vitest'
import { resolveSlideshowFrames } from '@/lib/board/slideshow-frames'

const yt = (thumbnail?: string) => ({
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  title: 'yt',
  thumbnail,
})

describe('resolveSlideshowFrames', () => {
  it('returns poster + ~25% + ~50% storyboard stills for YouTube (no end frame)', () => {
    const frames = resolveSlideshowFrames(yt('https://saved/thumb.jpg'))
    expect(frames).toEqual([
      { src: 'https://saved/thumb.jpg' },
      { src: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq1.jpg', fallback: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/1.jpg' },
      { src: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq2.jpg', fallback: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/2.jpg' },
    ])
    // Must never include the ~75% (hq3) or end frame.
    expect(JSON.stringify(frames)).not.toContain('hq3')
  })

  it('falls back to YouTube hqdefault as the poster when the item has no thumbnail', () => {
    const frames = resolveSlideshowFrames(yt(undefined))
    expect(frames[0]).toEqual({ src: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' })
  })

  it('returns the single poster for non-YouTube video cards (Vimeo / X / etc.)', () => {
    expect(
      resolveSlideshowFrames({ url: 'https://vimeo.com/12345', title: 'v', thumbnail: 'https://saved/v.jpg' }),
    ).toEqual([{ src: 'https://saved/v.jpg' }])
    expect(
      resolveSlideshowFrames({ url: 'https://x.com/u/status/1', title: 'x', thumbnail: 'https://saved/x.jpg', hasVideo: true }),
    ).toEqual([{ src: 'https://saved/x.jpg' }])
  })

  it('returns [] when there is no usable image', () => {
    expect(resolveSlideshowFrames({ url: 'https://vimeo.com/12345', title: 'v', thumbnail: undefined })).toEqual([])
  })

  // Mixed-media tweets (X video + still photos): the ambient slideshow uses the
  // tweet's OWN photos (+ the video poster appended) instead of running the
  // canvas video-frame extractor — pure cost saving, ported from the LoPo
  // housing cards. The extraction skip itself lives in CardsLayer's
  // resolveTweetVideoExtraction; here we only verify the frames it falls back to.
  it('mixed-media (X video + photos): returns the still photos with the video poster appended', () => {
    const frames = resolveSlideshowFrames({
      url: 'https://x.com/u/status/1',
      title: 'mix',
      thumbnail: 'https://saved/x.jpg',
      hasVideo: true,
      mediaSlots: [
        { type: 'video', url: 'https://poster.jpg', videoUrl: 'https://v.mp4' },
        { type: 'photo', url: 'https://p1.jpg' },
        { type: 'photo', url: 'https://p2.jpg' },
      ],
    })
    expect(frames).toEqual([
      { src: 'https://p1.jpg' },
      { src: 'https://p2.jpg' },
      { src: 'https://poster.jpg' },
    ])
  })

  it('photo-only mediaSlots: returns the photos with no poster appended', () => {
    const frames = resolveSlideshowFrames({
      url: 'https://x.com/u/status/1',
      title: 'photos',
      thumbnail: 'https://saved/x.jpg',
      mediaSlots: [
        { type: 'photo', url: 'https://p1.jpg' },
        { type: 'photo', url: 'https://p2.jpg' },
      ],
    })
    expect(frames).toEqual([{ src: 'https://p1.jpg' }, { src: 'https://p2.jpg' }])
  })

  it('video-only mediaSlots (no photos): unchanged — single poster/thumbnail, so extraction still runs', () => {
    const frames = resolveSlideshowFrames({
      url: 'https://x.com/u/status/1',
      title: 'vid',
      thumbnail: 'https://saved/x.jpg',
      hasVideo: true,
      mediaSlots: [{ type: 'video', url: 'https://poster.jpg', videoUrl: 'https://v.mp4' }],
    })
    expect(frames).toEqual([{ src: 'https://saved/x.jpg' }])
  })
})
