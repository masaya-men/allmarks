const $ = (id) => document.getElementById(id)
const AUTO_SAVE_KEYS = [
  'autoSaveXLike',
  'autoSaveXBookmark',
  'autoSaveYouTubeLike',
  'autoSaveYouTubeWatchLater',
  'autoSaveTikTokLike',
  'autoSaveTikTokFavorite',
  'autoSaveNoteLike',
  'autoSavePixivBookmark',
  'autoSavePixivLike',
  'autoSaveVimeoLike',
  'autoSaveVimeoWatchLater',
  'autoSaveSoundCloudLike',
  'autoSaveBlueskyLike',
  'autoSaveBlueskyRepost',
  'autoSaveThreadsLike',
]
const DEFAULTS = {
  autoOpenPip: false,
  cursorPillFallbackPosition: 'cursor',
  autoSaveXLike: true,
  autoSaveXBookmark: true,
  autoSaveYouTubeLike: true,
  autoSaveYouTubeWatchLater: true,
  autoSaveTikTokLike: true,
  autoSaveTikTokFavorite: true,
  autoSaveNoteLike: true,
  autoSavePixivBookmark: true,
  autoSavePixivLike: true,
  autoSaveVimeoLike: true,
  autoSaveVimeoWatchLater: true,
  autoSaveSoundCloudLike: true,
  autoSaveBlueskyLike: true,
  autoSaveBlueskyRepost: true,
  autoSaveThreadsLike: true,
}

async function load() {
  const stored = await chrome.storage.sync.get(DEFAULTS)
  $('autoOpenPip').checked = stored.autoOpenPip
  for (const key of AUTO_SAVE_KEYS) {
    $(key).checked = stored[key]
  }
  const pillPosInput = document.querySelector(
    'input[name="pillPos"][value="' + stored.cursorPillFallbackPosition + '"]'
  )
  if (pillPosInput) pillPosInput.checked = true
}

$('autoOpenPip').addEventListener('change', () => {
  chrome.storage.sync.set({ autoOpenPip: $('autoOpenPip').checked })
})

for (const key of AUTO_SAVE_KEYS) {
  $(key).addEventListener('change', () => {
    chrome.storage.sync.set({ [key]: $(key).checked })
  })
}

document.querySelectorAll('input[name="pillPos"]').forEach((el) => {
  el.addEventListener('change', () => {
    chrome.storage.sync.set({ cursorPillFallbackPosition: el.value })
  })
})

$('shortcuts-link').addEventListener('click', (e) => {
  e.preventDefault()
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })
})

load()
