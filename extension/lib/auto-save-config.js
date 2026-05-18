// Defaults + lookup for the "auto-save on SNS button" toggles.
// Source of truth — imported by background.js and tests/extension/auto-save-config.test.ts.
//
// Scope (= session 49 で確定): X / YouTube / note / Vimeo / SoundCloud の 5 site のみ
// ボタン連動を維持。 他サイトは「URL 保存」 経路 (= ショートカット / 右クリック /
// 拡張アイコン / ブックマーレット) で対応。

export const AUTO_SAVE_DEFAULTS = {
  autoSaveXLike: true,
  autoSaveXBookmark: true,
  autoSaveYouTubeLike: true,
  autoSaveYouTubeWatchLater: true,
  autoSaveNoteLike: true,
  autoSaveVimeoLike: true,
  autoSaveVimeoWatchLater: true,
  autoSaveSoundCloudLike: true,
}

export const SOURCE_TO_KEY = {
  'x-like': 'autoSaveXLike',
  'x-bookmark': 'autoSaveXBookmark',
  'yt-like': 'autoSaveYouTubeLike',
  'yt-watch-later': 'autoSaveYouTubeWatchLater',
  'note-like': 'autoSaveNoteLike',
  'vimeo-like': 'autoSaveVimeoLike',
  'vimeo-watch-later': 'autoSaveVimeoWatchLater',
  'soundcloud-like': 'autoSaveSoundCloudLike',
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
