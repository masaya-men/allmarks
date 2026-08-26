import { describe, it, expect } from 'vitest'
import { getYoutubeThumb, isYoutubeShortsUrl, isYoutubeThumbPlaceholder } from './youtube-thumb'

describe('getYoutubeThumb', () => {
  it('returns maxresdefault URL at level 0', () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    expect(getYoutubeThumb(url, 0)).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg')
  })

  it('falls back through hqdefault → mqdefault → 0', () => {
    const url = 'https://youtu.be/dQw4w9WgXcQ'
    expect(getYoutubeThumb(url, 1)).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
    expect(getYoutubeThumb(url, 2)).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg')
    expect(getYoutubeThumb(url, 3)).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/0.jpg')
  })

  it('returns null for invalid YouTube URL', () => {
    expect(getYoutubeThumb('https://example.com/foo', 0)).toBeNull()
  })

  it('isYoutubeShortsUrl detects shorts path', () => {
    expect(isYoutubeShortsUrl('https://www.youtube.com/shorts/abc123')).toBe(true)
    expect(isYoutubeShortsUrl('https://www.youtube.com/watch?v=abc123')).toBe(false)
  })
})

describe('isYoutubeThumbPlaceholder', () => {
  // i.ytimg.com returns HTTP 404 *with a valid, decodable ~120x90 JPEG body*
  // when a quality level doesn't exist for a video (confirmed via curl on a
  // real 404: Content-Type: image/jpeg, 120x90, 1097 bytes) — so <img
  // onError> never fires, the browser just "loads" the placeholder. This
  // must be caught by inspecting the loaded image's own dimensions instead.
  it('flags a 120px-wide load at level 0 (maxresdefault, expects 1280) as the placeholder', () => {
    expect(isYoutubeThumbPlaceholder(0, 120)).toBe(true)
  })

  it('flags a 120px-wide load at level 1 (hqdefault, expects 480) as the placeholder', () => {
    expect(isYoutubeThumbPlaceholder(1, 120)).toBe(true)
  })

  it('flags a 120px-wide load at level 2 (mqdefault, expects 320) as the placeholder', () => {
    expect(isYoutubeThumbPlaceholder(2, 120)).toBe(true)
  })

  it('does NOT flag level 3 (0.jpg) even at 120px — that IS its real, always-available size', () => {
    expect(isYoutubeThumbPlaceholder(3, 120)).toBe(false)
  })

  it('does not flag a real, larger thumbnail at levels 0-2', () => {
    expect(isYoutubeThumbPlaceholder(0, 1280)).toBe(false)
    expect(isYoutubeThumbPlaceholder(1, 480)).toBe(false)
    expect(isYoutubeThumbPlaceholder(2, 320)).toBe(false)
  })

  it('ignores a not-yet-loaded (0-width) image rather than treating it as a placeholder', () => {
    expect(isYoutubeThumbPlaceholder(0, 0)).toBe(false)
  })
})
