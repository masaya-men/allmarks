// URL normalization for the saved-urls mirror.
//
// Problem this solves (session 58):
// The same content can land in the user's browser as many distinct URL
// strings: `youtube.com/watch?v=abc`, `youtube.com/watch?v=abc&list=...`,
// `youtube.com/watch?v=abc&t=42s`, `x.com/u/status/1?ref_src=...&t=...`,
// `example.com/post?utm_source=newsletter`, etc.
//
// String comparison treats those as different URLs, so the floating button
// stays grey on revisit even when the content was already saved. We
// normalize both the saved URL (= mirror key) and the lookup URL
// (= location.href on revisit) so equivalent URLs map to the same key.
//
// Strategy: blacklist-based. We strip
//   - global tracking params (utm_*, fbclid, gclid, ref_*, mc_*, _ga, _gl, igshid, vero_id, mkt_tok)
//   - YouTube-specific noise (list, index, t, pp, si, feature, ab_channel, start_radio, kid, themeRefresh)
//   - X/Twitter noise (ref_src, s, t, cn)
// We keep the URL's hash fragment (#section, #comment-123) since some sites
// (GitHub, MDN, StackOverflow) use it to address sub-content the user means
// to save. Trailing slashes are removed. Hostname is lowercased.

const GLOBAL_TRACKING_PREFIXES = ['utm_', 'mc_', '_ga', '_gl']
const GLOBAL_TRACKING_EXACT = new Set([
  'fbclid', 'gclid', 'dclid', 'gbraid', 'wbraid', 'msclkid', 'yclid',
  'igshid', 'vero_id', 'mkt_tok', 'oly_anon_id', 'oly_enc_id',
  'mkt_tok', 'trk', 'trkCampaign', 'sc_campaign', 'sc_channel',
])

const PER_HOST_DROP = {
  // YouTube — playlist/index/timestamp/share are display-only, the v= param
  // is the canonical content id.
  'youtube.com': new Set(['list', 'index', 't', 'pp', 'si', 'feature', 'ab_channel', 'start_radio', 'kid', 'themeRefresh', 'app']),
  'm.youtube.com': new Set(['list', 'index', 't', 'pp', 'si', 'feature', 'ab_channel', 'start_radio', 'kid', 'themeRefresh', 'app']),
  // X / Twitter — referral source and short tokens are not part of identity.
  'x.com': new Set(['ref_src', 's', 't', 'cn']),
  'twitter.com': new Set(['ref_src', 's', 't', 'cn']),
  'mobile.x.com': new Set(['ref_src', 's', 't', 'cn']),
  'mobile.twitter.com': new Set(['ref_src', 's', 't', 'cn']),
}

function shouldDropParam(host, name) {
  if (GLOBAL_TRACKING_EXACT.has(name)) return true
  for (const prefix of GLOBAL_TRACKING_PREFIXES) {
    if (name.startsWith(prefix)) return true
  }
  const perHost = PER_HOST_DROP[host]
  if (perHost && perHost.has(name)) return true
  return false
}

// Normalize a URL string. Returns the input unchanged if parsing fails,
// so the caller never has to handle exceptions. Idempotent —
// normalizeUrl(normalizeUrl(x)) === normalizeUrl(x).
export function normalizeUrl(input) {
  if (!input || typeof input !== 'string') return input
  let url
  try { url = new URL(input) } catch (_) { return input }
  // Only normalize http(s). Leave chrome://, file://, etc. alone.
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return input
  // Lowercase the hostname — URLs are case-insensitive in the authority.
  url.hostname = url.hostname.toLowerCase()
  // Strip default ports.
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
    url.port = ''
  }
  // Drop tracking + per-host noise params.
  const host = url.hostname.replace(/^www\./, '')
  const keep = []
  for (const [name, value] of url.searchParams) {
    if (!shouldDropParam(host, name)) keep.push([name, value])
  }
  // Re-set the search params. Note: URLSearchParams preserves insertion
  // order, so the surviving params keep their relative order from the
  // original URL — important when two URLs differ only by reordered
  // tracking params (rare but possible).
  url.search = ''
  for (const [name, value] of keep) url.searchParams.append(name, value)
  // Trailing slash: remove from non-root paths so /foo and /foo/ unify.
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '')
  }
  return url.toString()
}
