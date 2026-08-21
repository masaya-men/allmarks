// Maximum age before a card is eligible for re-scraping. 7 days strikes
// a balance between picking up source-side OGP changes quickly and not
// hammering /api/ogp. Lightbox open/nav additionally trigger revalidate
// on demand, so viewport cadence is the safety net, not the only path.
export const REVALIDATE_AGE_MS = 7 * 24 * 60 * 60 * 1000

// A transient failure (network error, upstream 4xx/5xx, timeout) is retried
// much sooner than a resolved status re-check -- but with real backoff, not
// on every single board reload. Previously an 'unknown' result was never
// persisted at all, so a bookmark stuck failing (e.g. an upstream that's
// rate-limiting scrapers) got re-enqueued on every items-array change while
// visible -- one card produced 14 back-to-back /api/ogp calls in a single
// session with no delay between them.
export const REVALIDATE_RETRY_AFTER_FAILURE_MS = 60 * 60 * 1000 // 1 hour

// Decide whether a bookmark is due for revalidation. undefined / null
// lastCheckedAt = never attempted = due. Otherwise the required gap depends
// on the outcome of the last attempt: a transient failure (linkStatus ===
// 'unknown') only needs REVALIDATE_RETRY_AFTER_FAILURE_MS before trying
// again; a resolved status (alive/gone, or never attempted) uses the full
// REVALIDATE_AGE_MS cadence.
export function shouldRevalidate(
  lastCheckedAt: number | undefined,
  linkStatus: 'alive' | 'gone' | 'unknown' | undefined,
  now: number,
): boolean {
  if (lastCheckedAt == null) return true
  const interval = linkStatus === 'unknown' ? REVALIDATE_RETRY_AFTER_FAILURE_MS : REVALIDATE_AGE_MS
  return now - lastCheckedAt > interval
}

export type RevalidationResult =
  | { kind: 'alive'; data?: { title?: string; image?: string; description?: string; favicon?: string; siteName?: string } }
  | { kind: 'gone' }
  | { kind: 'unknown' /* transient failure — do not change status */ }

export type Fetcher = (url: string) => Promise<RevalidationResult>

// Default fetcher hits /api/ogp. 404/410 = gone. 5xx/timeout/network = unknown (transient).
export const defaultFetcher: Fetcher = async (url) => {
  try {
    const res = await fetch(`/api/ogp?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(10_000) })
    if (res.status === 404 || res.status === 410) return { kind: 'gone' }
    if (!res.ok) return { kind: 'unknown' }
    const data = await res.json()
    if (data?.error) return { kind: 'unknown' }
    return { kind: 'alive', data }
  } catch {
    return { kind: 'unknown' }
  }
}

type QueueOptions = {
  readonly fetcher: Fetcher
  readonly maxConcurrent?: number
  readonly onResult?: (bookmarkId: string, result: RevalidationResult) => void | Promise<void>
}

// Bounded-concurrency queue for revalidation fetches. dedup by bookmarkId.
export class RevalidationQueue {
  private inFlight = new Set<string>()
  private pending: Array<{ id: string; url: string }> = []
  private readonly fetcher: Fetcher
  private readonly maxConcurrent: number
  private readonly onResult?: QueueOptions['onResult']

  constructor(opts: QueueOptions) {
    this.fetcher = opts.fetcher
    this.maxConcurrent = opts.maxConcurrent ?? 3
    this.onResult = opts.onResult
  }

  enqueue(id: string, url: string): void {
    if (this.inFlight.has(id)) return
    if (this.pending.some((p) => p.id === id)) return
    this.pending.push({ id, url })
    this.pump()
  }

  private pump(): void {
    while (this.inFlight.size < this.maxConcurrent && this.pending.length > 0) {
      const next = this.pending.shift()
      if (!next) break
      this.inFlight.add(next.id)
      void this.fetcher(next.url)
        .then(async (r) => { await this.onResult?.(next.id, r) })
        .catch(async () => { await this.onResult?.(next.id, { kind: 'unknown' }) })
        .finally(() => {
          this.inFlight.delete(next.id)
          this.pump()
        })
    }
  }
}
