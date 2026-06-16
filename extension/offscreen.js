import { createOffscreenRouter } from './lib/offscreen-router.js'

const iframe = document.getElementById('save')
// Canonical save destination origin. Must match the iframe src in offscreen.html
// (the bridge writes into this origin's IndexedDB). Post-rebrand this is
// allmarks.app; the `booklage:*` message types below stay as a stable internal
// protocol contract with the web app's /save-iframe page (do not rename).
const BOOKLAGE_ORIGIN = 'https://allmarks.app'
const router = createOffscreenRouter()

window.addEventListener('message', (ev) => {
  if (ev.origin !== BOOKLAGE_ORIGIN) return
  const data = ev.data
  if (!data || typeof data !== 'object') return
  if (data.type === 'booklage:save:result' || data.type === 'booklage:probe:result') {
    router.resolve(data.nonce, data)
  }
})

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.target !== 'offscreen') return false
  if (msg.type === 'forward-to-iframe') {
    router.register(msg.nonce, { postMessage: sendResponse })
    iframe.contentWindow.postMessage(msg.envelope, BOOKLAGE_ORIGIN)
    // 8s gives slow iframe loads / cold service worker wakeups headroom.
    // dispatch.js auto-retries once with a fresh offscreen on timeout, so
    // the worst case for the user is ~16s before the red pill — still
    // recoverable, and the common case sees zero failures.
    setTimeout(() => router.timeout(msg.nonce), 8000)
    return true // async
  }
  return false
})
