import { describe, it, expect } from 'vitest'
import { AUTO_SAVE_DEFAULTS, SOURCE_TO_KEY, configKeyForSource, isAutoSaveEnabled } from '../../extension/lib/auto-save-config.js'

describe('auto-save-config', () => {
  it('maps every source to a config key', () => {
    expect(configKeyForSource('x-like')).toBe('autoSaveXLike')
    expect(configKeyForSource('x-bookmark')).toBe('autoSaveXBookmark')
    expect(configKeyForSource('yt-like')).toBe('autoSaveYouTubeLike')
    expect(configKeyForSource('yt-watch-later')).toBe('autoSaveYouTubeWatchLater')
    expect(configKeyForSource('tiktok-like')).toBe('autoSaveTikTokLike')
    expect(configKeyForSource('tiktok-favorite')).toBe('autoSaveTikTokFavorite')
    expect(configKeyForSource('note-like')).toBe('autoSaveNoteLike')
    expect(configKeyForSource('pixiv-bookmark')).toBe('autoSavePixivBookmark')
    expect(configKeyForSource('pixiv-like')).toBe('autoSavePixivLike')
    expect(configKeyForSource('vimeo-like')).toBe('autoSaveVimeoLike')
    expect(configKeyForSource('vimeo-watch-later')).toBe('autoSaveVimeoWatchLater')
    expect(configKeyForSource('soundcloud-like')).toBe('autoSaveSoundCloudLike')
    expect(configKeyForSource('bluesky-like')).toBe('autoSaveBlueskyLike')
    expect(configKeyForSource('bluesky-repost')).toBe('autoSaveBlueskyRepost')
    expect(configKeyForSource('threads-like')).toBe('autoSaveThreadsLike')
  })

  it('returns null for unknown sources', () => {
    expect(configKeyForSource('unknown')).toBeNull()
    expect(configKeyForSource('')).toBeNull()
  })

  it('defaults every toggle to ON', () => {
    for (const key of Object.values(SOURCE_TO_KEY)) {
      expect(AUTO_SAVE_DEFAULTS[key as keyof typeof AUTO_SAVE_DEFAULTS]).toBe(true)
    }
  })

  it('isAutoSaveEnabled honors the stored value when present', async () => {
    const storage = {
      get: async (defaults: Record<string, unknown>) => ({ ...defaults, autoSaveXLike: false }),
    }
    expect(await isAutoSaveEnabled('x-like', storage)).toBe(false)
  })

  it('isAutoSaveEnabled falls back to the default (ON) when no stored value', async () => {
    const storage = {
      get: async (defaults: Record<string, unknown>) => ({ ...defaults }),
    }
    expect(await isAutoSaveEnabled('x-like', storage)).toBe(true)
    expect(await isAutoSaveEnabled('yt-watch-later', storage)).toBe(true)
  })

  it('isAutoSaveEnabled returns false for unknown sources', async () => {
    const storage = { get: async () => ({}) }
    expect(await isAutoSaveEnabled('made-up', storage)).toBe(false)
  })
})
