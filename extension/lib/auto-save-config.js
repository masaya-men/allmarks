// Defaults + lookup for the four "auto-save on SNS button" toggles.
// Source of truth — imported by background.js and tests/extension/auto-save-config.test.ts.

export const AUTO_SAVE_DEFAULTS = {
  autoSaveXLike: true,
  autoSaveXBookmark: true,
  autoSaveYouTubeLike: true,
  autoSaveYouTubeWatchLater: true,
}

export const SOURCE_TO_KEY = {
  'x-like': 'autoSaveXLike',
  'x-bookmark': 'autoSaveXBookmark',
  'yt-like': 'autoSaveYouTubeLike',
  'yt-watch-later': 'autoSaveYouTubeWatchLater',
}

export function configKeyForSource(source) {
  return SOURCE_TO_KEY[source] || null
}

export async function isAutoSaveEnabled(source, storageArea) {
  const key = configKeyForSource(source)
  if (!key) return false
  const stored = await storageArea.get({ [key]: AUTO_SAVE_DEFAULTS[key] })
  return !!stored[key]
}
