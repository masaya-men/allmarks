import { describe, it, expect } from 'vitest'
import { computeAspectRatio, deriveThumbnail } from './use-board-data'
import type { BookmarkRecord, CardRecord } from './indexeddb'

const baseBookmark: BookmarkRecord = {
  id: 'b1',
  url: 'https://example.com/article',
  title: 'Article',
  description: '',
  thumbnail: '',
  favicon: '',
  siteName: 'Example',
  type: 'website',
  savedAt: '2026-04-19T00:00:00Z',
  folderId: 'root',
  ogpStatus: 'fetched',
  tags: ['root'],
}

const baseCard: CardRecord = {
  id: 'c1',
  bookmarkId: 'b1',
  folderId: 'root',
  x: 0,
  y: 0,
  rotation: 0,
  scale: 1,
  zIndex: 0,
  gridIndex: 0,
  isManuallyPlaced: false,
  width: 240,
  height: 320,
}

describe('computeAspectRatio priority chain', () => {
  it('priority 1: user-resized card returns width/height', () => {
    const c: CardRecord = { ...baseCard, width: 400, height: 200, isUserResized: true, aspectRatio: 0.5 }
    expect(computeAspectRatio(baseBookmark, c)).toBe(2)
  })

  it('priority 1 skipped when width/height are zero → falls to cached ratio', () => {
    const c: CardRecord = { ...baseCard, width: 0, height: 0, isUserResized: true, aspectRatio: 1.5 }
    expect(computeAspectRatio(baseBookmark, c)).toBe(1.5)
  })

  it('priority 2: cached aspectRatio wins when not user-resized', () => {
    const c: CardRecord = { ...baseCard, width: 100, height: 100, isUserResized: false, aspectRatio: 1.77 }
    expect(computeAspectRatio(baseBookmark, c)).toBe(1.77)
  })

  it('priority 3: falls back to estimator when no card record', () => {
    const ratio = computeAspectRatio(baseBookmark, undefined)
    expect(typeof ratio).toBe('number')
    expect(ratio).toBeGreaterThan(0)
  })

  it('priority 3: YouTube URL estimates 16:9 when no cached ratio', () => {
    const youtubeBookmark: BookmarkRecord = {
      ...baseBookmark,
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      type: 'youtube',
    }
    const c: CardRecord = { ...baseCard, isUserResized: false, aspectRatio: 0 }
    expect(computeAspectRatio(youtubeBookmark, c)).toBeCloseTo(16 / 9, 2)
  })
})

describe('deriveThumbnail', () => {
  it('prefers the per-video YouTube CDN thumbnail over a captured og:image', () => {
    // The saved og:image is YouTube's generic white logo — we must ignore it
    // and use the real per-video thumbnail (which is what the board shows).
    const yt: BookmarkRecord = {
      ...baseBookmark,
      url: 'https://www.youtube.com/watch?v=ir_PRErPnb0',
      type: 'youtube',
      thumbnail: 'https://example.com/generic-youtube-logo.png',
    }
    expect(deriveThumbnail(yt)).toBe('https://i.ytimg.com/vi/ir_PRErPnb0/hqdefault.jpg')
  })

  it('derives the CDN thumbnail for YouTube Shorts too', () => {
    const short: BookmarkRecord = {
      ...baseBookmark,
      url: 'https://www.youtube.com/shorts/lXuk3GAQMmg',
      type: 'youtube',
      thumbnail: '',
    }
    expect(deriveThumbnail(short)).toBe('https://i.ytimg.com/vi/lXuk3GAQMmg/hqdefault.jpg')
  })

  it('keeps the captured thumbnail for non-YouTube bookmarks', () => {
    const site: BookmarkRecord = { ...baseBookmark, thumbnail: 'https://example.com/og.png' }
    expect(deriveThumbnail(site)).toBe('https://example.com/og.png')
  })

  it('returns undefined for a non-YouTube bookmark with no thumbnail', () => {
    expect(deriveThumbnail({ ...baseBookmark, thumbnail: '' })).toBeUndefined()
  })
})
