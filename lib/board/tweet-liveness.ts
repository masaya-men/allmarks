import type { RevalidationResult, Fetcher } from './revalidate'
import { detectUrlType, extractTweetId } from '@/lib/utils/url'

// The proxy that relays cdn.syndication.twimg.com (token computed server-side
// in functions/api/tweet-meta.ts). 404 = deleted/nonexistent. 200 +
// __typename:"Tweet" = live. Any other 200 (tombstone: suspended / protected /
// age-restricted) = gone.
const PROXY_ENDPOINT = '/api/tweet-meta'

// Minimal injectable fetch contract so the mapping is unit-testable without a
// network or a deployed Function. The real `fetch`'s Response satisfies this
// structurally.
export type LivenessFetch = (url: string) => Promise<{
  ok: boolean
  status: number
  json: () => Promise<unknown>
}>

// Production fetch: real network + a 10s timeout. Kept separate from
// checkTweetLiveness so unit tests inject a mock and never create a real timer.
const defaultLivenessFetch: LivenessFetch = (url) =>
  fetch(url, { signal: AbortSignal.timeout(10_000) })

// True only for a confirmed live Tweet payload. Keyed on __typename — the
// canonical signal react-tweet itself uses for availability — NOT on
// parseTweetData (which returns null for benign reasons such as a media-only
// tweet with empty text, so it can't distinguish gone from alive).
function isLiveTweet(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const d = data as { __typename?: unknown; id_str?: unknown }
  return d.__typename === 'Tweet' && typeof d.id_str === 'string' && d.id_str.length > 0
}

// Decide tweet liveness from the syndication proxy response. Network is
// injected. alive IFF a confirmed live Tweet; everything else 200 is gone;
// 404 is gone; 5xx / thrown (timeout / network) is unknown (don't change state).
export async function checkTweetLiveness(
  tweetId: string,
  fetchImpl: LivenessFetch = defaultLivenessFetch,
): Promise<RevalidationResult> {
  try {
    const res = await fetchImpl(`${PROXY_ENDPOINT}?id=${encodeURIComponent(tweetId)}`)
    if (res.status === 404) return { kind: 'gone' }
    if (!res.ok) return { kind: 'unknown' }
    const data: unknown = await res.json()
    return isLiveTweet(data) ? { kind: 'alive' } : { kind: 'gone' }
  } catch {
    return { kind: 'unknown' }
  }
}

// Compose the existing OGP fetcher with a tweet-aware path. Tweet status URLs
// go to the syndication liveness check; everything else (including X profile /
// home URLs that carry no tweet id) delegates to the OGP fetcher unchanged.
export function createCompositeFetcher(
  ogpFetcher: Fetcher,
  livenessFetch: LivenessFetch = defaultLivenessFetch,
): Fetcher {
  return async (url: string): Promise<RevalidationResult> => {
    if (detectUrlType(url) === 'tweet') {
      const id = extractTweetId(url)
      if (id) return checkTweetLiveness(id, livenessFetch)
    }
    return ogpFetcher(url)
  }
}
