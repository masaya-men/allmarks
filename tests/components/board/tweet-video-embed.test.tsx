import { describe, it, expect } from 'vitest'
import { resolveTweetVideoSource } from '@/components/board/embeds/TweetVideoEmbed'

describe('resolveTweetVideoSource', () => {
  it('uses the video mediaSlot when present (no fetch needed)', () => {
    const src = resolveTweetVideoSource({
      url: 'https://x.com/u/status/1',
      title: 't',
      thumbnail: 'https://img/poster.jpg',
      mediaSlots: [{ type: 'video', url: 'https://img/slotposter.jpg', videoUrl: 'https://v/clip.mp4', aspect: 1.7 }],
    })
    expect(src).toEqual({ videoUrl: 'https://v/clip.mp4', posterUrl: 'https://img/slotposter.jpg', aspect: 1.7 })
  })

  it('falls back to the item thumbnail for the poster when the slot has no poster url', () => {
    const src = resolveTweetVideoSource({
      url: 'https://x.com/u/status/1',
      title: 't',
      thumbnail: 'https://img/poster.jpg',
      mediaSlots: [{ type: 'video', url: '', videoUrl: 'https://v/clip.mp4' }],
    })
    expect(src?.videoUrl).toBe('https://v/clip.mp4')
    expect(src?.posterUrl).toBe('https://img/poster.jpg')
  })

  it('returns null when there is no video slot (needs a meta fetch instead)', () => {
    const src = resolveTweetVideoSource({
      url: 'https://x.com/u/status/1',
      title: 't',
      thumbnail: undefined,
      mediaSlots: [{ type: 'photo', url: 'https://img/a.jpg' }],
    })
    expect(src).toBeNull()
  })
})
