const $ = (id) => document.getElementById(id)

// ── i18n: replace [data-i18n*] with chrome.i18n messages (browser UI language) ──
function applyI18n() {
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const msg = chrome.i18n.getMessage(el.dataset.i18n)
    if (msg) el.textContent = msg
  }
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) {
    const msg = chrome.i18n.getMessage(el.dataset.i18nPlaceholder)
    if (msg) el.setAttribute('placeholder', msg)
  }
  const title = chrome.i18n.getMessage('optDocTitle')
  if (title) document.title = title
  document.documentElement.lang = chrome.i18n.getUILanguage()
}
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

// ── "SAVED" indicator pulse on the card a control belongs to ──
function pulseSaved(controlEl) {
  const card = controlEl && controlEl.closest('.card')
  const saved = card && card.querySelector('.saved')
  if (!saved) return
  saved.classList.add('is-saving')
  clearTimeout(saved._t)
  saved._t = setTimeout(() => saved.classList.remove('is-saving'), 1200)
}

// ── Idle-opacity slider (stored 0..1, shown 0..60%) ──
function applyIdleOpacityUi(percent) {
  const slider = $('floatingButtonIdleOpacity')
  const label = $('idleOpacityLabel')
  slider.style.setProperty('--fill', (percent / Number(slider.max)) * 100 + '%')
  if (percent === 0) label.textContent = chrome.i18n.getMessage('optIdleOpacityHidden')
  else if (percent === 30) label.textContent = chrome.i18n.getMessage('optIdleOpacityDefault')
  else label.textContent = percent + '%'
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
  const pct = Math.round(Number(stored.floatingButtonIdleOpacity) * 100)
  $('floatingButtonIdleOpacity').value = String(pct)
  applyIdleOpacityUi(pct)
  renderDisabledDomains(stored.floatingButtonDisabledDomains || [])
}

function renderDisabledDomains(list) {
  const root = $('floatingButtonDisabledList')
  root.innerHTML = ''
  if (!list.length) {
    const empty = document.createElement('p')
    empty.className = 'domain-empty'
    empty.textContent = chrome.i18n.getMessage('optFloatingNoSites')
    root.appendChild(empty)
    return
  }
  for (const domain of list) {
    const row = document.createElement('div')
    row.className = 'domain-row'
    const label = document.createElement('span')
    label.className = 'name'
    label.textContent = domain
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'am flat'
    btn.textContent = chrome.i18n.getMessage('optFloatingRemove')
    btn.addEventListener('click', async () => {
      const stored = await chrome.storage.sync.get({ floatingButtonDisabledDomains: [] })
      const next = (stored.floatingButtonDisabledDomains || []).filter((d) => d !== domain)
      await chrome.storage.sync.set({ floatingButtonDisabledDomains: next })
      renderDisabledDomains(next)
      pulseSaved($('floatingButtonAddDomainBtn'))
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
    pulseSaved($(key))
  })
}

document.querySelectorAll('input[name="pillPos"]').forEach((el) => {
  el.addEventListener('change', () => {
    chrome.storage.sync.set({ cursorPillFallbackPosition: el.value })
    pulseSaved(el)
  })
})

$('shortcuts-link').addEventListener('click', (e) => {
  e.preventDefault()
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })
})

// Floating button — enabled toggle
$('floatingButtonEnabled').addEventListener('change', () => {
  chrome.storage.sync.set({ floatingButtonEnabled: $('floatingButtonEnabled').checked })
  pulseSaved($('floatingButtonEnabled'))
})

// Floating button — idle opacity slider
$('floatingButtonIdleOpacity').addEventListener('input', () => {
  applyIdleOpacityUi(Number($('floatingButtonIdleOpacity').value))
})
$('floatingButtonIdleOpacity').addEventListener('change', () => {
  const pct = Number($('floatingButtonIdleOpacity').value)
  chrome.storage.sync.set({ floatingButtonIdleOpacity: pct / 100 })
  pulseSaved($('floatingButtonIdleOpacity'))
})

// Floating button — reset position
$('floatingButtonResetPosition').addEventListener('click', () => {
  chrome.storage.sync.set({
    floatingButtonSnapSide: 'right',
    floatingButtonTopRatio: 0.5,
  })
  pulseSaved($('floatingButtonResetPosition'))
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
  pulseSaved($('floatingButtonAddDomainBtn'))
})

$('floatingButtonAddDomain').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    $('floatingButtonAddDomainBtn').click()
  }
})

// ── Open AllMarks board (about link) ──
$('openBoard').addEventListener('click', (e) => {
  e.preventDefault()
  chrome.tabs.create({ url: 'https://allmarks.app/board' })
})

// ── Version / build from the real manifest ──
function applyVersion() {
  try {
    const m = chrome.runtime.getManifest()
    $('verNum').textContent = m.version
  } catch {
    /* leave dashes */
  }
}

// ── Real saved-URL count ("AllMarks · N") from the local mirror ──
async function applySavedCount() {
  let n = 0
  try {
    const s = await chrome.storage.local.get({ savedUrlsMirror: {} })
    n = Object.keys(s.savedUrlsMirror || {}).length
  } catch {
    return
  }
  document.querySelectorAll('.saved-count').forEach((el) => {
    el.textContent = n.toLocaleString()
  })
}

if (chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.savedUrlsMirror) applySavedCount()
  })
}

// ── Sidebar nav: smooth-scroll + scroll-spy ──
function setupNav() {
  const navItems = [...document.querySelectorAll('.nav-item')]
  navItems.forEach((it) => {
    it.addEventListener('click', (e) => {
      e.preventDefault()
      const target = document.getElementById(it.dataset.target)
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  })
  const spy = navItems
    .map((it) => ({ it, sec: document.getElementById(it.dataset.target) }))
    .filter((x) => x.sec)
  function onScroll() {
    let active = spy[0]
    for (const x of spy) {
      if (x.sec.getBoundingClientRect().top <= 160) active = x
    }
    navItems.forEach((it) => it.classList.toggle('is-active', active && it === active.it))
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
}

applyI18n()
applyVersion()
applySavedCount()
setupNav()
load()
