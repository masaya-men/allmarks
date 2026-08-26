// AllMarks Service Worker
// Cache strategy:
//   - Pre-cache: /board (main app), manifest, icons
//   - Cache-first: /_next/static/* (hashed immutable assets)
//   - Network-first: HTML pages and other assets
//   - Skip: API calls, non-GET requests

// Bump on each deploy to force clients to flush old caches.
const CACHE_VERSION = 'v98-2026-08-26-cross-origin-fetch-skip'
const CACHE_NAME = 'booklage-' + CACHE_VERSION

var PRECACHE_URLS = [
  '/board',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
]

// ── Install: pre-cache shell ──────────────────────────────
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_URLS)
    }).then(function () {
      return self.skipWaiting()
    })
  )
})

// ── Activate: clean old caches ────────────────────────────
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) {
            return key.startsWith('booklage-') && key !== CACHE_NAME
          })
          .map(function (key) {
            return caches.delete(key)
          })
      )
    }).then(function () {
      return self.clients.claim()
    })
  )
})

// ── Fetch: routing by URL pattern ─────────────────────────
self.addEventListener('fetch', function (event) {
  var request = event.request

  // Skip non-GET requests
  if (request.method !== 'GET') return

  var url = new URL(request.url)

  // Skip cross-origin requests entirely (third-party CDN thumbnails: YouTube,
  // TikTok, Twitter/X, generic OGP images, etc). These are never cached below
  // anyway — they're opaque (no-cors) responses, so `response.ok` is always
  // false and the cache.put branch never runs for them — so intercepting them
  // buys nothing. It does carry a real risk: if the underlying request gets
  // cancelled (e.g. an <img> unmounted mid-load when the board's viewport
  // culling removes its card during a fast scroll), the SW's own fetch()
  // rejects, the catch below falls through to caches.match(), which resolves
  // to undefined for a never-cached URL, and respondWith(undefined) makes the
  // browser report a network error — visible as a broken/gray thumbnail.
  // Skipping interception lets the browser handle these requests/cancellation
  // natively, the same as if no Service Worker were installed at all.
  if (url.origin !== self.location.origin) return

  // Skip API calls — OGP fetch requires network
  if (url.pathname.startsWith('/api/')) return

  // Cache-first for hashed static assets (immutable — filename contains hash)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(function (cached) {
        if (cached) return cached
        return fetch(request).then(function (response) {
          if (response.ok) {
            var clone = response.clone()
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(request, clone)
            })
          }
          return response
        })
      })
    )
    return
  }

  // Network-first for HTML pages and other assets
  event.respondWith(
    fetch(request).then(function (response) {
      if (response.ok) {
        var clone = response.clone()
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(request, clone)
        })
      }
      return response
    }).catch(function () {
      return caches.match(request)
    })
  )
})
