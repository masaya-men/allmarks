const $ = (id) => document.getElementById(id)
const AUTO_SAVE_KEYS = [
  'autoSaveXLike',
  'autoSaveXBookmark',
  'autoSaveYouTubeLike',
  'autoSaveYouTubeWatchLater',
  'autoSaveNoteLike',
  'autoSaveVimeoLike',
  'autoSaveVimeoWatchLater',
  'autoSaveSoundCloudLike',
]
const DEFAULTS = {
  cursorPillFallbackPosition: 'cursor',
  autoSaveXLike: true,
  autoSaveXBookmark: true,
  autoSaveYouTubeLike: true,
  autoSaveYouTubeWatchLater: true,
  autoSaveNoteLike: true,
  autoSaveVimeoLike: true,
  autoSaveVimeoWatchLater: true,
  autoSaveSoundCloudLike: true,
}

async function load() {
  const stored = await chrome.storage.sync.get(DEFAULTS)
  for (const key of AUTO_SAVE_KEYS) {
    $(key).checked = stored[key]
  }
  const pillPosInput = document.querySelector(
    'input[name="pillPos"][value="' + stored.cursorPillFallbackPosition + '"]'
  )
  if (pillPosInput) pillPosInput.checked = true
}

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
