import { describe, it, expect } from 'vitest'
import { upgradeImageResolution } from './upgrade-image-resolution'

describe('upgradeImageResolution', () => {
  describe('pbs.twimg.com (X / Twitter)', () => {
    it('bumps the modern name= param to orig', () => {
      expect(upgradeImageResolution('https://pbs.twimg.com/media/ABC123?format=jpg&name=small')).toBe(
        'https://pbs.twimg.com/media/ABC123?format=jpg&name=orig',
      )
      expect(upgradeImageResolution('https://pbs.twimg.com/media/ABC123?name=900x900&format=png')).toBe(
        'https://pbs.twimg.com/media/ABC123?name=orig&format=png',
      )
    })

    it('leaves an already-orig url unchanged', () => {
      const u = 'https://pbs.twimg.com/media/ABC123?format=jpg&name=orig'
      expect(upgradeImageResolution(u)).toBe(u)
    })

    it('bumps the legacy :size suffix to :orig', () => {
      expect(upgradeImageResolution('https://pbs.twimg.com/media/ABC123.jpg:large')).toBe(
        'https://pbs.twimg.com/media/ABC123.jpg:orig',
      )
    })

    it('leaves a bare media url without a size hint unchanged (do not risk breaking it)', () => {
      const u = 'https://pbs.twimg.com/media/ABC123.jpg'
      expect(upgradeImageResolution(u)).toBe(u)
    })
  })

  describe('YouTube CDN', () => {
    it('bumps hqdefault to maxresdefault', () => {
      expect(upgradeImageResolution('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg')).toBe(
        'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      )
      expect(upgradeImageResolution('https://img.youtube.com/vi/dQw4w9WgXcQ/sddefault.jpg')).toBe(
        'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      )
    })

    it('leaves an already-maxres url unchanged', () => {
      const u = 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'
      expect(upgradeImageResolution(u)).toBe(u)
    })
  })

  describe('passthrough', () => {
    it('returns general og:image urls unchanged (no universal high-res form)', () => {
      const u = 'https://example.com/wp-content/uploads/og-image.png'
      expect(upgradeImageResolution(u)).toBe(u)
    })

    it('returns empty / invalid input unchanged', () => {
      expect(upgradeImageResolution('')).toBe('')
      expect(upgradeImageResolution('not a url')).toBe('not a url')
    })

    it('leaves a pbs.twimg.com avatar (profile_images) url unchanged', () => {
      // profile_images carry _normal/_bigger, but the upgrade is scoped to media
      // size params (name= / :size) only, so an avatar passes through unchanged.
      const u = 'https://pbs.twimg.com/profile_images/123/avatar_normal.jpg'
      expect(upgradeImageResolution(u)).toBe(u)
    })
  })
})
