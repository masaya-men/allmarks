for (const el of document.querySelectorAll('[data-i18n]')) {
  const msg = chrome.i18n.getMessage(el.dataset.i18n)
  if (msg) el.textContent = msg
}
document.documentElement.lang = chrome.i18n.getUILanguage()
document.getElementById('settings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage()
})
