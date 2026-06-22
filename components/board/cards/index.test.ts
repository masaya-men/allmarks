import { describe, it, expect } from 'vitest'
import { pickCard, VideoThumbCard, ImageCard, PlaceholderCard, isPlaceholderCard, itemSkylineHeight, PLACEHOLDER_ASPECT } from './index'
import type { BoardItem } from '@/lib/storage/use-board-data'

// vi.mock with primitive-string named exports stopped applying after the
// vitest 4.x upgrade — pickCard returned the real component function, not
// the mocked string, and `expect(result).toBe('VideoThumbCard')` failed.
// Compare component identities directly instead. CSS module imports inside
// the component files are handled by vite's default CSS-module proxy in
// the test env, so we can import the real components here without the
// mock-based CSS workaround that the original test setup needed.

const baseItem: BoardItem = {
  bookmarkId: 'b1',
  cardId: 'c1',
  title: 'test',
  url: 'https://example.com',
  aspectRatio: 1,
  gridIndex: 0,
  orderIndex: 0,
  cardWidth: 240,
  customCardWidth: false,
  isRead: false,
  isDeleted: false,
  tags: [],
  displayMode: null,
}

describe('pickCard', () => {
  it('routes YouTube → VideoThumbCard', () => {
    const result = pickCard({ ...baseItem, url: 'https://youtube.com/watch?v=abc' })
    expect(result).toBe(VideoThumbCard)
  })

  it('routes TikTok → VideoThumbCard', () => {
    const result = pickCard({ ...baseItem, url: 'https://tiktok.com/@u/video/1' })
    expect(result).toBe(VideoThumbCard)
  })

  it('routes tweet with thumbnail → ImageCard', () => {
    const r1 = pickCard({ ...baseItem, url: 'https://x.com/u/status/1', thumbnail: 'tweet.jpg' })
    const r2 = pickCard({ ...baseItem, url: 'https://twitter.com/u/status/1', thumbnail: 'tweet.jpg' })
    expect(r1).toBe(ImageCard)
    expect(r2).toBe(ImageCard)
  })

  it('routes tweet without thumbnail → PlaceholderCard', () => {
    const result = pickCard({ ...baseItem, url: 'https://x.com/u/status/1' })
    expect(result).toBe(PlaceholderCard)
  })

  it('routes generic with thumbnail → ImageCard', () => {
    const result = pickCard({ ...baseItem, url: 'https://example.com', thumbnail: 'x.jpg' })
    expect(result).toBe(ImageCard)
  })

  it('routes generic without thumbnail → PlaceholderCard', () => {
    const result = pickCard({ ...baseItem, url: 'https://r3f.maximeheckel.com/lens2' })
    expect(result).toBe(PlaceholderCard)
  })
})

describe('isPlaceholderCard', () => {
  it('true for a thumbnail-less generic card', () => {
    expect(isPlaceholderCard({ ...baseItem, url: 'https://example.com' })).toBe(true)
  })
  it('false when a thumbnail is present (ImageCard)', () => {
    expect(isPlaceholderCard({ ...baseItem, thumbnail: 'x.jpg' })).toBe(false)
  })
  it('false for video (YouTube/TikTok)', () => {
    expect(isPlaceholderCard({ ...baseItem, url: 'https://youtube.com/watch?v=a' })).toBe(false)
  })
})

describe('itemSkylineHeight', () => {
  // The anti-reshuffle invariant: a placeholder card's layout height is FIXED
  // at width / PLACEHOLDER_ASPECT and does NOT depend on item.aspectRatio (the
  // estimated value that used to be used until the card mounted and reported a
  // different height, shuffling every card below it while scrolling).
  it.each([1.7, 0.5, 1, 0, 3.2])(
    'placeholder height is width/PLACEHOLDER_ASPECT regardless of aspectRatio=%s',
    (aspectRatio) => {
      const h = itemSkylineHeight({ ...baseItem, url: 'https://example.com', aspectRatio }, 250)
      expect(h).toBeCloseTo(250 / PLACEHOLDER_ASPECT, 5)
    },
  )

  it('image card scales by its aspectRatio', () => {
    const h = itemSkylineHeight({ ...baseItem, thumbnail: 'x.jpg', aspectRatio: 2 }, 240)
    expect(h).toBe(120)
  })

  it('video card scales by its aspectRatio', () => {
    const h = itemSkylineHeight({ ...baseItem, url: 'https://youtube.com/watch?v=a', aspectRatio: 1.6 }, 320)
    expect(h).toBeCloseTo(200, 5)
  })

  it('non-placeholder with aspectRatio 0 falls back to a square (width)', () => {
    const h = itemSkylineHeight({ ...baseItem, thumbnail: 'x.jpg', aspectRatio: 0 }, 240)
    expect(h).toBe(240)
  })
})
