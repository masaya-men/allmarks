import { describe, it, expect } from 'vitest'
import { canPlayInline } from '@/components/board/embeds/InlineMediaPlayer'

describe('canPlayInline', () => {
  it('returns true for youtube / vimeo / soundcloud / tiktok urls', () => {
    expect(canPlayInline('https://www.youtube.com/watch?v=abc')).toBe(true)
    expect(canPlayInline('https://vimeo.com/12345')).toBe(true)
    expect(canPlayInline('https://soundcloud.com/artist/track')).toBe(true)
    expect(canPlayInline('https://www.tiktok.com/@u/video/123')).toBe(true)
  })

  it('returns false for a generic webpage, image, tweet, or instagram', () => {
    expect(canPlayInline('https://example.com/article')).toBe(false)
    expect(canPlayInline('https://x.com/u/status/123')).toBe(false)
    expect(canPlayInline('https://www.instagram.com/reel/abc/')).toBe(false)
  })
})
