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
})
