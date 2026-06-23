import { describe, it, expect } from 'vitest'
import { normalizeUrl } from '../../extension/lib/normalize-url.js'

// rank28 guard. The per-site auto-save suppression (twitter.js / youtube.js /
// note.js / vimeo.js / soundcloud.js) checks `savedUrlMirror.has(rawExtractedUrl)`
// against mirror keys that dispatch.js stores as `normalizeUrl(ogp.url)`. That
// probe is raw-vs-normalized: it only matches because every per-site extractor
// today emits an already-canonical URL, i.e. `normalizeUrl(canonical) === canonical`.
//
// This test pins that invariant so a future change to normalizeUrl that would
// alter one of these canonical forms — and silently break "Already saved"
// suppression on an already-saved page — fails CI instead of shipping.
//
// NOTE: it locks the NORMALIZER side of the contract. It cannot catch a per-site
// *extractor* that starts emitting a non-canonical URL (that needs an extractor
// test). The cheapest full fix would be to also normalize the probe inside each
// isUrlAlreadySaved(), but those plain content scripts can't import, so we avoid
// duplicating normalizeUrl into 5 files and rely on this guard + the fact that
// extractors are already canonical. See audit rank28.
describe('rank28 — per-site mirror probe invariant (extracted URLs must be normalize-stable)', () => {
  const CANONICAL_EXTRACTED_URLS = [
    'https://x.com/handle/status/1234567890',
    'https://twitter.com/handle/status/1234567890',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://soundcloud.com/artist/track-name',
    'https://note.com/username/n/n0123456789ab',
    'https://vimeo.com/123456789',
  ]
  for (const url of CANONICAL_EXTRACTED_URLS) {
    it(`normalizeUrl is identity for ${url}`, () => {
      expect(normalizeUrl(url)).toBe(url)
    })
  }
})
