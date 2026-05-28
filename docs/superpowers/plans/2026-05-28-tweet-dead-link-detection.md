# X 削除ツイートのリンク切れ検出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect unreachable X tweets (deleted / suspended / protected / age-restricted) during the existing revalidation sweep and mark them `linkStatus='gone'` so they flow into the already-built DEAD LINKS filter + badge.

**Architecture:** Add a tweet-aware path to the injectable revalidation `Fetcher`. Tweet URLs are checked via the existing `/api/tweet-meta` syndication proxy (404 or non-Tweet 200 → gone; confirmed-Tweet 200 → alive; 5xx/timeout → unknown). Non-tweet URLs keep using the existing OGP fetcher. The board swaps its `defaultFetcher` for a composite fetcher — one line. No IDB schema change, no Cloudflare Function change.

**Tech Stack:** TypeScript (strict), Next.js App Router, Vitest. Reuses `lib/board/revalidate.ts` (`Fetcher`, `RevalidationResult`, `RevalidationQueue`, `defaultFetcher`), `lib/utils/url.ts` (`detectUrlType`, `extractTweetId`), and the deployed `functions/api/tweet-meta.ts` proxy.

**Spec:** [docs/superpowers/specs/2026-05-28-tweet-dead-link-detection-design.md](../specs/2026-05-28-tweet-dead-link-detection-design.md)

---

## File Structure

- **Create** `lib/board/tweet-liveness.ts` — the tweet liveness checker (`checkTweetLiveness`), the live-Tweet predicate (`isLiveTweet`, internal), and the composite fetcher factory (`createCompositeFetcher`). Network access is injected so the mapping is unit-testable without a network or a deployed Function.
- **Create** `tests/lib/tweet-liveness.test.ts` — deterministic unit tests for the mapping and the routing.
- **Modify** `components/board/BoardRoot.tsx` — swap `fetcher: defaultFetcher` for `fetcher: createCompositeFetcher(defaultFetcher)` and add the import (2 lines).

No other files change. `lib/board/revalidate.ts` exports stay untouched.

---

## Reference: existing types (do not redefine — import these)

From `lib/board/revalidate.ts` (already in the repo):

```ts
export type RevalidationResult =
  | { kind: 'alive'; data?: { title?: string; image?: string; description?: string; favicon?: string; siteName?: string } }
  | { kind: 'gone' }
  | { kind: 'unknown' /* transient failure — do not change status */ }

export type Fetcher = (url: string) => Promise<RevalidationResult>
```

---

## Task 1: Tweet liveness checker (pure mapping)

Maps the `/api/tweet-meta` proxy response to a `RevalidationResult`. Network is injected via a `LivenessFetch` so tests never touch the network.

**Files:**
- Create: `lib/board/tweet-liveness.ts`
- Test: `tests/lib/tweet-liveness.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/tweet-liveness.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { checkTweetLiveness } from '@/lib/board/tweet-liveness'

// Minimal response stub matching the LivenessFetch contract.
const res = (status: number, body?: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

describe('checkTweetLiveness', () => {
  it('maps HTTP 404 to gone (deleted / nonexistent)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(404))
    expect(await checkTweetLiveness('1', fetchImpl)).toEqual({ kind: 'gone' })
  })

  it('maps 200 + __typename:"Tweet" with id_str to alive', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(200, { __typename: 'Tweet', id_str: '20', text: 'hi' }))
    expect(await checkTweetLiveness('20', fetchImpl)).toEqual({ kind: 'alive' })
  })

  it('maps 200 + TweetTombstone to gone (suspended / protected / age-restricted)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(200, { __typename: 'TweetTombstone', tombstone: { text: {} } }))
    expect(await checkTweetLiveness('123', fetchImpl)).toEqual({ kind: 'gone' })
  })

  it('maps 200 + body with no __typename to gone', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(200, {}))
    expect(await checkTweetLiveness('123', fetchImpl)).toEqual({ kind: 'gone' })
  })

  it('maps 200 + Tweet WITHOUT id_str to gone (defensive)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(200, { __typename: 'Tweet' }))
    expect(await checkTweetLiveness('123', fetchImpl)).toEqual({ kind: 'gone' })
  })

  it('maps HTTP 5xx to unknown (transient)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(502))
    expect(await checkTweetLiveness('123', fetchImpl)).toEqual({ kind: 'unknown' })
  })

  it('maps a thrown fetch (network / timeout) to unknown', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network'))
    expect(await checkTweetLiveness('123', fetchImpl)).toEqual({ kind: 'unknown' })
  })

  it('queries the proxy with the encoded tweet id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(200, { __typename: 'Tweet', id_str: '20' }))
    await checkTweetLiveness('20', fetchImpl)
    expect(fetchImpl).toHaveBeenCalledWith('/api/tweet-meta?id=20')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `rtk vitest run tests/lib/tweet-liveness.test.ts`
Expected: FAIL — `checkTweetLiveness` is not exported / module not found.

- [ ] **Step 3: Write the minimal implementation**

Create `lib/board/tweet-liveness.ts`:

```ts
import type { RevalidationResult } from './revalidate'

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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `rtk vitest run tests/lib/tweet-liveness.test.ts`
Expected: PASS — 8 tests in the `checkTweetLiveness` describe block.

- [ ] **Step 5: Commit**

```bash
rtk git add lib/board/tweet-liveness.ts tests/lib/tweet-liveness.test.ts
rtk git commit -m "feat(board): tweet liveness checker via syndication proxy"
```

---

## Task 2: Composite fetcher (URL routing)

Routes tweet URLs to `checkTweetLiveness` and everything else to the existing OGP fetcher.

**Files:**
- Modify: `lib/board/tweet-liveness.ts` (append `createCompositeFetcher`)
- Test: `tests/lib/tweet-liveness.test.ts` (append a `createCompositeFetcher` describe block)

- [ ] **Step 1: Write the failing tests**

Append to `tests/lib/tweet-liveness.test.ts` (add `createCompositeFetcher` to the existing import from `@/lib/board/tweet-liveness`, and add `import type { Fetcher } from '@/lib/board/revalidate'` at the top):

```ts
describe('createCompositeFetcher', () => {
  const ogp: Fetcher = async () => ({ kind: 'alive', data: { title: 'ogp' } })

  it('routes a tweet status URL to the liveness check, not OGP', async () => {
    const ogpSpy = vi.fn(ogp)
    const livenessFetch = vi.fn().mockResolvedValue(res(404))
    const fetcher = createCompositeFetcher(ogpSpy, livenessFetch)
    const result = await fetcher('https://x.com/jack/status/20')
    expect(result).toEqual({ kind: 'gone' })
    expect(ogpSpy).not.toHaveBeenCalled()
    expect(livenessFetch).toHaveBeenCalledWith('/api/tweet-meta?id=20')
  })

  it('delegates a non-tweet URL to the OGP fetcher', async () => {
    const ogpSpy = vi.fn(ogp)
    const livenessFetch = vi.fn()
    const fetcher = createCompositeFetcher(ogpSpy, livenessFetch)
    const result = await fetcher('https://example.com/article')
    expect(result).toEqual({ kind: 'alive', data: { title: 'ogp' } })
    expect(ogpSpy).toHaveBeenCalledWith('https://example.com/article')
    expect(livenessFetch).not.toHaveBeenCalled()
  })

  it('delegates an X URL with no tweet id (profile / home) to OGP', async () => {
    const ogpSpy = vi.fn(ogp)
    const livenessFetch = vi.fn()
    const fetcher = createCompositeFetcher(ogpSpy, livenessFetch)
    await fetcher('https://x.com/jack')
    expect(ogpSpy).toHaveBeenCalledWith('https://x.com/jack')
    expect(livenessFetch).not.toHaveBeenCalled()
  })
})
```

The top-of-file import lines should now read:

```ts
import { describe, it, expect, vi } from 'vitest'
import { checkTweetLiveness, createCompositeFetcher } from '@/lib/board/tweet-liveness'
import type { Fetcher } from '@/lib/board/revalidate'
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `rtk vitest run tests/lib/tweet-liveness.test.ts`
Expected: FAIL — `createCompositeFetcher` is not exported.

- [ ] **Step 3: Write the minimal implementation**

Append to `lib/board/tweet-liveness.ts`. Add the two imports at the top of the file and the factory at the bottom:

```ts
// add to the existing imports at the top of the file:
import type { Fetcher } from './revalidate'
import { detectUrlType, extractTweetId } from '@/lib/utils/url'
```

```ts
// append at the bottom of the file:

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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `rtk vitest run tests/lib/tweet-liveness.test.ts`
Expected: PASS — all tests (8 in `checkTweetLiveness` + 3 in `createCompositeFetcher`).

- [ ] **Step 5: Commit**

```bash
rtk git add lib/board/tweet-liveness.ts tests/lib/tweet-liveness.test.ts
rtk git commit -m "feat(board): composite revalidation fetcher routing tweets to liveness check"
```

---

## Task 3: Wire the composite fetcher into the board + full verification

**Files:**
- Modify: `components/board/BoardRoot.tsx:15` (import) and `:803` (fetcher wiring)

- [ ] **Step 1: Add the import**

In `components/board/BoardRoot.tsx`, immediately after the existing line 15:

```tsx
import { RevalidationQueue, defaultFetcher, shouldRevalidate } from '@/lib/board/revalidate'
```

add:

```tsx
import { createCompositeFetcher } from '@/lib/board/tweet-liveness'
```

- [ ] **Step 2: Swap the fetcher**

In the `new RevalidationQueue({ ... })` call (around line 802), change:

```tsx
    revalidateQueueRef.current = new RevalidationQueue({
      fetcher: defaultFetcher,
```

to:

```tsx
    revalidateQueueRef.current = new RevalidationQueue({
      fetcher: createCompositeFetcher(defaultFetcher),
```

Leave the `onResult` callback and everything else unchanged. (`onResult` already handles `alive`/`gone`/`unknown`; tweet `alive` carries no `data.image`, so `persistThumbnail` is correctly not called.)

- [ ] **Step 3: Typecheck**

Run: `rtk tsc`
Expected: 0 errors.

- [ ] **Step 4: Run the full test suite (no regressions)**

Run: `rtk vitest run`
Expected: PASS — previous total + 11 new tests, 0 failures.

- [ ] **Step 5: Build (static export must succeed)**

Run: `rtk pnpm build`
Expected: build succeeds, `out/` regenerated, all static routes exported. (Use `pnpm build`, never `next build` — only `pnpm build` runs the static export per project config.)

- [ ] **Step 6: Commit**

```bash
rtk git add components/board/BoardRoot.tsx
rtk git commit -m "feat(board): route tweet revalidation through syndication liveness check"
```

---

## Task 4: Deploy + manual production verification

The liveness check only runs against the deployed `/api/tweet-meta` Function, so verification happens on production (`booklage.pages.dev`).

- [ ] **Step 1: Deploy to production**

```bash
rtk pnpm build
npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="deploy: tweet dead-link detection"
```

(`--branch=master` is required so it lands on `booklage.pages.dev`. `--commit-message` is ASCII because wrangler rejects a Japanese git commit body.)

- [ ] **Step 2: Verify a deleted tweet is detected**

On `https://booklage.pages.dev` (hard reload):
1. Save a known-deleted X tweet URL as a bookmark (or open an existing tweet bookmark whose tweet is gone). If none exists, save a fabricated status URL such as `https://x.com/x/status/1999999999999999999` (returns 404 from syndication).
2. Open the card (Lightbox) or scroll it into view — this triggers `revalidateOnIntent` / the viewport observer.
3. Open the filter dropdown → DEAD LINKS. Confirm the card appears there with the "リンク切れ" badge, and that clicking it no longer opens the Lightbox.

Expected: the deleted/nonexistent tweet surfaces under DEAD LINKS within one revalidation cycle.

- [ ] **Step 3: Verify a live tweet stays alive**

1. Confirm an existing, live tweet bookmark does NOT move to DEAD LINKS after a viewport / open trigger.

Expected: live tweets are unaffected; non-tweet bookmarks behave exactly as before.

- [ ] **Step 4: Report results to the user**

Summarize: deleted tweet detection working in production, live tweets unaffected. Note any tweet whose `lastCheckedAt` is fresh (< 7 days) won't re-check until due — mention this if a recently-checked card doesn't flip immediately.

---

## Self-Review

**1. Spec coverage:**
- "tweet-aware fetcher routes tweet URLs to syndication, others to OGP" → Task 2 (`createCompositeFetcher`) + Task 3 (wiring). ✓
- Mapping table (404→gone / Tweet→alive / tombstone→gone / 5xx→unknown) → Task 1 tests + `checkTweetLiveness`. ✓
- "don't reuse parseTweetData; key on __typename" → `isLiveTweet` predicate + test cases. ✓
- "no Function change, no schema bump" → only 3 client files touched; no `functions/` or `indexeddb.ts` edits. ✓
- "reuse DEAD LINKS filter / badge / triggers / onResult" → Task 3 leaves `onResult`, filter, triggers untouched; verified in Task 4. ✓
- Edge case: X profile/home URL with no tweet id → delegates to OGP → Task 2 third test. ✓
- Verification: unit tests (Tasks 1–2), tsc/vitest/build (Task 3), production manual check (Task 4). ✓

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N". All code blocks are complete. ✓

**3. Type consistency:** `LivenessFetch`, `checkTweetLiveness(tweetId, fetchImpl)`, `createCompositeFetcher(ogpFetcher, livenessFetch)`, `isLiveTweet(data)`, `RevalidationResult`, `Fetcher` — names and signatures match across the implementation and the tests. The proxy query string `/api/tweet-meta?id=<id>` is identical in the implementation and the `toHaveBeenCalledWith` assertions. ✓
