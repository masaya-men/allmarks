// Mirror of saved URLs in chrome.storage.local. Used by the floating save button
// to render the "already saved" state on revisit without cross-origin IDB reads.
//
// Format on storage:
//   { savedUrlsMirror: { [url]: timestampMs } }
//
// Set rather than Array because the lookup is the hot path. timestampMs lets us
// prune the oldest 10% when we exceed MAX_ENTRIES.

export const STORAGE_KEY = 'savedUrlsMirror'
export const MAX_ENTRIES = 50000
export const PRUNE_FRACTION = 0.1  // drop oldest 10% when full

export async function loadMirror(storageArea) {
  const stored = await storageArea.get({ [STORAGE_KEY]: {} })
  return stored[STORAGE_KEY] || {}
}

export async function hasUrl(url, storageArea) {
  if (!url) return false
  const mirror = await loadMirror(storageArea)
  return Object.prototype.hasOwnProperty.call(mirror, url)
}

export async function addUrl(url, storageArea, now = Date.now()) {
  if (!url) return
  const mirror = await loadMirror(storageArea)
  mirror[url] = now
  const next = maybePrune(mirror)
  await storageArea.set({ [STORAGE_KEY]: next })
}

// Pure (no IO) so tests can exercise it directly.
export function maybePrune(mirror) {
  const entries = Object.entries(mirror)
  if (entries.length <= MAX_ENTRIES) return mirror
  const dropCount = Math.ceil(entries.length * PRUNE_FRACTION)
  entries.sort((a, b) => a[1] - b[1])  // oldest first
  const survivors = entries.slice(dropCount)
  const next = {}
  for (const [k, v] of survivors) next[k] = v
  return next
}
