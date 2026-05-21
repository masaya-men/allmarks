import { describe, it, expect } from 'vitest'
import { canPlayInline } from '@/components/board/embeds/media-players'
import type { PlayableItem } from '@/components/board/embeds/media-players'

const item = (over: Partial<PlayableItem>): PlayableItem => ({
  url: 'https://example.com', title: 't', thumbnail: undefined, aspectRatio: 1, ...over,
})

describe('canPlayInline (registry-derived)', () => {
  it('is true for the iframe platforms', () => {
    expect(canPlayInline(item({ url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa' }))).toBe(true)
    expect(canPlayInline(item({ url: 'https://vimeo.com/12345' }))).toBe(true)
    expect(canPlayInline(item({ url: 'https://soundcloud.com/a/b' }))).toBe(true)
    expect(canPlayInline(item({ url: 'https://www.tiktok.com/@u/video/123' }))).toBe(true)
  })

  it('is true for a tweet that has a video mediaSlot (mp4 entry)', () => {
    expect(canPlayInline(item({
      url: 'https://x.com/u/status/1',
      mediaSlots: [{ type: 'video', url: 'p', videoUrl: 'https://v/clip.mp4' }],
    }))).toBe(true)
  })

  it('is true for a tweet flagged hasVideo even before backfill lands', () => {
    expect(canPlayInline(item({ url: 'https://x.com/u/status/1', hasVideo: true }))).toBe(true)
  })

  it('is false for a photo-only tweet, instagram, and generic webpages', () => {
    expect(canPlayInline(item({ url: 'https://x.com/u/status/1', mediaSlots: [{ type: 'photo', url: 'p' }] }))).toBe(false)
    expect(canPlayInline(item({ url: 'https://www.instagram.com/reel/abc/' }))).toBe(false)
    expect(canPlayInline(item({ url: 'https://example.com/article' }))).toBe(false)
  })
})
