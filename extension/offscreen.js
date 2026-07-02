import { createOffscreenRouter } from './lib/offscreen-router.js'
import { startRepostPump } from './lib/offscreen-repost.js'

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
  if (
    data.type === 'booklage:save:result' ||
    data.type === 'booklage:probe:result' ||
    data.type === 'booklage:add-tag:result'
  ) {
    router.resolve(data.nonce, data)
  }
})

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.target !== 'offscreen') return false
  if (msg.type === 'forward-to-iframe') {
    router.register(msg.nonce, { postMessage: sendResponse })
    // Cold-start race guard (N-15): the iframe (allmarks.app/save-iframe) only
    // attaches its `message` listener after its React app hydrates, so a single
    // post can land before the listener exists and be dropped — window
    // postMessage does not buffer for a listener that shows up later. Re-post
    // the SAME envelope until the iframe answers (router.resolve clears the
    // nonce) or the deadline elapses; the iframe dedupes by nonce so redundant
    // posts never double-save. See lib/offscreen-repost.js. dispatch.js still
    // retries once on timeout, so a genuinely dead bridge is unchanged.
    startRepostPump({
      post: () => {
        try {
          iframe.contentWindow.postMessage(msg.envelope, BOOKLAGE_ORIGIN)
        } catch (_) {
          // contentWindow can be momentarily unavailable while the offscreen
          // iframe is (re)loading — a later tick re-posts.
        }
      },
      isPending: () => router.has(msg.nonce),
      onTimeout: () => router.timeout(msg.nonce),
    })
    return true // async
  }
  return false
})
