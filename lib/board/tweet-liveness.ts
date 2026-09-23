import type { RevalidationResult, Fetcher } from './revalidate'
import { detectUrlType, extractTweetId } from '@/lib/utils/url'

// The proxy that relays cdn.syndication.twimg.com (token computed server-side
// in functions/api/tweet-meta.ts). 404 = deleted/nonexistent (verified
// empirically against the real CDN: a genuinely nonexistent tweet id returns
// a clean 404, never a 200 tombstone). 200 + __typename:"Tweet" = live. Any
// other 200 (tombstone: suspended / protected / age-restricted) = unknown,
// NOT gone (N-70) — this anonymous, logged-out check can't tell "the tweet
// doesn't exist" apart from "this account is protected/age-gated and
// invisible to OUR checker specifically". A protected-account tweet the
// bookmarking user still follows is genuinely alive to them, so treating
// every non-live-shaped 200 as gone produced false "dead link" cards
// (grayed out AND click-blocked — see BoardRoot.tsx's linkStatus==='gone'
// guard) for links the user could still open fine themselves.
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

// s219: a TweetTombstone's tombstone.text.text carries a human-readable reason
// that differs by cause ("This Post was deleted by the Post author." verified
// empirically against a real deleted tweet's syndication response — see the
// user report this was added for). Only THAT specific, unambiguous phrase maps
// to 'gone'; every other tombstone reason (suspended / protected / age-gated —
// exact wording not verified against a real example) stays 'unknown' exactly
// as before N-70's original safe-bucket behavior. Narrow substring match, not
// exact-equality, so incidental whitespace/punctuation drift in the phrase
// doesn't silently stop matching.
function isAuthorDeletedTombstone(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const d = data as { __typename?: unknown; tombstone?: { text?: { text?: unknown } } }
  if (d.__typename !== 'TweetTombstone') return false
  const text = d.tombstone?.text?.text
  return typeof text === 'string' && text.includes('deleted by the Post author')
}

// Decide tweet liveness from the syndication proxy response. Network is
// injected. alive IFF a confirmed live Tweet; a tombstone explicitly saying
// the author deleted it is gone; every other 200 is unknown; 404 is gone;
// 5xx / thrown (timeout / network) is unknown (don't change state).
export async function checkTweetLiveness(
  tweetId: string,
  fetchImpl: LivenessFetch = defaultLivenessFetch,
): Promise<RevalidationResult> {
  try {
    const res = await fetchImpl(`${PROXY_ENDPOINT}?id=${encodeURIComponent(tweetId)}`)
    if (res.status === 404) return { kind: 'gone' }
    if (!res.ok) return { kind: 'unknown' }
    const data: unknown = await res.json()
    if (isLiveTweet(data)) return { kind: 'alive' }
    if (isAuthorDeletedTombstone(data)) return { kind: 'gone' }
    return { kind: 'unknown' }
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
