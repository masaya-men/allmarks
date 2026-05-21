import { describe, it, expect } from 'vitest'
import { canPlayInline } from '@/components/board/embeds/InlineMediaPlayer'

const item = (url: string, over: object = {}): { url: string; title: string; thumbnail: undefined; aspectRatio: number } =>
  ({ url, title: 't', thumbnail: undefined, aspectRatio: 1, ...over })

describe('canPlayInline (via InlineMediaPlayer re-export)', () => {
  it('returns true for youtube / vimeo / soundcloud / tiktok', () => {
    expect(canPlayInline(item('https://www.youtube.com/watch?v=aaaaaaaaaaa'))).toBe(true)
    expect(canPlayInline(item('https://vimeo.com/12345'))).toBe(true)
    expect(canPlayInline(item('https://soundcloud.com/a/b'))).toBe(true)
    expect(canPlayInline(item('https://www.tiktok.com/@u/video/123'))).toBe(true)
  })

  it('returns true for a video tweet, false for photo tweet / instagram / generic', () => {
    expect(canPlayInline(item('https://x.com/u/status/1', { hasVideo: true }))).toBe(true)
    expect(canPlayInline(item('https://x.com/u/status/1', { mediaSlots: [{ type: 'photo', url: 'p' }] }))).toBe(false)
    expect(canPlayInline(item('https://www.instagram.com/reel/abc/'))).toBe(false)
    expect(canPlayInline(item('https://example.com/article'))).toBe(false)
  })
})
