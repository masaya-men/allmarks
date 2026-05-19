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
  floatingButtonEnabled: true,
  floatingButtonIdleOpacity: 0.3,
  floatingButtonSnapSide: 'right',
  floatingButtonTopRatio: 0.5,
  floatingButtonDisabledDomains: [],
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
  // Floating button settings
  $('floatingButtonEnabled').checked = !!stored.floatingButtonEnabled
  $('floatingButtonIdleOpacity').value = String(stored.floatingButtonIdleOpacity)
  renderDisabledDomains(stored.floatingButtonDisabledDomains || [])
}

function renderDisabledDomains(list) {
  const root = $('floatingButtonDisabledList')
  root.innerHTML = ''
  if (!list.length) {
    const empty = document.createElement('p')
    empty.className = 'lede'
    empty.style.margin = '0 0 8px'
    empty.textContent = 'No sites hidden yet.'
    root.appendChild(empty)
    return
  }
  for (const domain of list) {
    const row = document.createElement('div')
    row.className = 'row'
    const label = document.createElement('span')
    label.style.flex = '1'
    label.textContent = domain
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = 'Remove'
    btn.addEventListener('click', async () => {
      const stored = await chrome.storage.sync.get({ floatingButtonDisabledDomains: [] })
      const next = (stored.floatingButtonDisabledDomains || []).filter((d) => d !== domain)
      await chrome.storage.sync.set({ floatingButtonDisabledDomains: next })
      renderDisabledDomains(next)
    })
    row.appendChild(label)
    row.appendChild(btn)
    root.appendChild(row)
  }
}

function normalizeDomain(input) {
  let d = (input || '').trim().toLowerCase()
  if (!d) return ''
  // Strip protocol + path.
  d = d.replace(/^https?:\/\//, '')
  d = d.split('/')[0]
  d = d.replace(/^www\./, '')
  if (!/^[a-z0-9.-]+\.[a-z0-9-]+$/i.test(d)) return ''
  return d
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

// Floating button — enabled toggle
$('floatingButtonEnabled').addEventListener('change', () => {
  chrome.storage.sync.set({ floatingButtonEnabled: $('floatingButtonEnabled').checked })
})

// Floating button — idle opacity
$('floatingButtonIdleOpacity').addEventListener('change', () => {
  chrome.storage.sync.set({ floatingButtonIdleOpacity: Number($('floatingButtonIdleOpacity').value) })
})

// Floating button — reset position
$('floatingButtonResetPosition').addEventListener('click', () => {
  chrome.storage.sync.set({
    floatingButtonSnapSide: 'right',
    floatingButtonTopRatio: 0.5,
  })
})

// Floating button — add disabled domain
$('floatingButtonAddDomainBtn').addEventListener('click', async () => {
  const input = $('floatingButtonAddDomain')
  const domain = normalizeDomain(input.value)
  if (!domain) {
    input.focus()
    input.select()
    return
  }
  const stored = await chrome.storage.sync.get({ floatingButtonDisabledDomains: [] })
  const list = stored.floatingButtonDisabledDomains || []
  if (list.includes(domain)) {
    input.value = ''
    return
  }
  const next = [...list, domain].sort()
  await chrome.storage.sync.set({ floatingButtonDisabledDomains: next })
  renderDisabledDomains(next)
  input.value = ''
})

$('floatingButtonAddDomain').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    $('floatingButtonAddDomainBtn').click()
  }
})

load()
