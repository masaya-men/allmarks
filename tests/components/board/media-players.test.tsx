import { describe, it, expect } from 'vitest'
import { canPlayInline, canViewportAutoplay } from '@/components/board/embeds/media-players'
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

describe('canViewportAutoplay (Tier 1 gate)', () => {
  it('is true for YouTube (visual video — reliable autoplay)', () => {
    expect(canViewportAutoplay(item({ url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa' }))).toBe(true)
  })

  it('is true for Vimeo (visual video — reliable autoplay)', () => {
    expect(canViewportAutoplay(item({ url: 'https://vimeo.com/12345' }))).toBe(true)
  })

  it('is true for a tweet/mp4 video slot (native mp4 — reliable autoplay)', () => {
    expect(canViewportAutoplay(item({
      url: 'https://x.com/u/status/1',
      mediaSlots: [{ type: 'video', url: 'p', videoUrl: 'https://v/clip.mp4' }],
    }))).toBe(true)
  })

  it('is true for a tweet flagged hasVideo', () => {
    expect(canViewportAutoplay(item({ url: 'https://x.com/u/status/1', hasVideo: true }))).toBe(true)
  })

  it('is false for TikTok (unreliable autoplay + uncloseable CTA)', () => {
    expect(canViewportAutoplay(item({ url: 'https://www.tiktok.com/@u/video/123' }))).toBe(false)
  })

  it('canPlayInline is still true for TikTok (Tier 3 click-to-play works)', () => {
    expect(canPlayInline(item({ url: 'https://www.tiktok.com/@u/video/123' }))).toBe(true)
  })

  it('is false for SoundCloud (audio — muted produces no visible motion)', () => {
    expect(canViewportAutoplay(item({ url: 'https://soundcloud.com/a/b' }))).toBe(false)
  })

  it('canPlayInline is still true for SoundCloud (Tier 3 click-to-play works)', () => {
    expect(canPlayInline(item({ url: 'https://soundcloud.com/a/b' }))).toBe(true)
  })
})
