import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { resolveTweetVideoSource, TweetVideoEmbed } from '@/components/board/embeds/TweetVideoEmbed'

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

describe('TweetVideoEmbed — onUnplayable (Tier 1 fallback)', () => {
  it('calls onUnplayable when the <video> fires an error event', () => {
    const onUnplayable = vi.fn()
    const item = {
      url: 'https://x.com/u/status/123',
      title: 'Test tweet',
      thumbnail: undefined,
    }
    const source = {
      videoUrl: 'https://example.com/clip.mp4',
      posterUrl: undefined,
      aspect: 16 / 9,
    }
    const { container } = render(
      <TweetVideoEmbed
        item={item}
        source={source}
        variant="inline"
        autoStart
        muted
        onUnplayable={onUnplayable}
      />,
    )
    const video = container.querySelector('video')
    expect(video).not.toBeNull()
    // Simulate a network/decode error on the native <video> element.
    fireEvent.error(video!)
    expect(onUnplayable).toHaveBeenCalledOnce()
  })

  it('does NOT call onUnplayable when no prop is provided (Tier 3 behavior)', () => {
    const item = {
      url: 'https://x.com/u/status/123',
      title: 'Test tweet',
      thumbnail: undefined,
    }
    const source = {
      videoUrl: 'https://example.com/clip.mp4',
      posterUrl: undefined,
      aspect: 16 / 9,
    }
    // Should render without throwing and show "Watch on X" on error instead.
    const { container } = render(
      <TweetVideoEmbed
        item={item}
        source={source}
        variant="inline"
        autoStart
      />,
    )
    const video = container.querySelector('video')
    expect(video).not.toBeNull()
    // Fire error — no onUnplayable prop, expect "Watch on X" link appears.
    fireEvent.error(video!)
    expect(container.querySelector('a')).not.toBeNull()
  })
})
