import { describe, it, expect, vi } from 'vitest'
import {
  shouldRevalidate, RevalidationQueue, REVALIDATE_AGE_MS, REVALIDATE_RETRY_AFTER_FAILURE_MS,
} from '@/lib/board/revalidate'

describe('shouldRevalidate', () => {
  it('returns true for never-checked', () => {
    expect(shouldRevalidate(undefined, undefined, Date.now())).toBe(true)
  })

  it('returns true if last check older than max age (resolved status)', () => {
    const old = Date.now() - REVALIDATE_AGE_MS - 1000
    expect(shouldRevalidate(old, 'alive', Date.now())).toBe(true)
  })

  it('returns false for fresh check (resolved status)', () => {
    expect(shouldRevalidate(Date.now() - 1000, 'alive', Date.now())).toBe(false)
  })

  it('returns false if last check within max age boundary (resolved status)', () => {
    const exact = Date.now() - REVALIDATE_AGE_MS + 1000
    expect(shouldRevalidate(exact, 'alive', Date.now())).toBe(false)
  })

  it('uses the full max age (not the short failure cooldown) when linkStatus is "gone"', () => {
    const justFailed = Date.now() - REVALIDATE_RETRY_AFTER_FAILURE_MS - 1000
    expect(shouldRevalidate(justFailed, 'gone', Date.now())).toBe(false)
  })

  it('a transient failure (linkStatus "unknown") is NOT due again immediately', () => {
    const justFailed = Date.now() - 1000
    expect(shouldRevalidate(justFailed, 'unknown', Date.now())).toBe(false)
  })

  it('a transient failure becomes due again after REVALIDATE_RETRY_AFTER_FAILURE_MS, not the full 7-day age', () => {
    const pastFailureCooldown = Date.now() - REVALIDATE_RETRY_AFTER_FAILURE_MS - 1000
    expect(shouldRevalidate(pastFailureCooldown, 'unknown', Date.now())).toBe(true)
    // still well inside the 7-day window a resolved status would use
    expect(Date.now() - pastFailureCooldown).toBeLessThan(REVALIDATE_AGE_MS)
  })
})

describe('RevalidationQueue', () => {
  it('limits concurrent fetches to 3', async () => {
    const fetchMock = vi.fn(() =>
      new Promise((resolve) => setTimeout(() => resolve({ kind: 'alive', data: {} }), 50)),
    )
    const queue = new RevalidationQueue({ fetcher: fetchMock as never, maxConcurrent: 3 })
    queue.enqueue('b1', 'https://example.com/1')
    queue.enqueue('b2', 'https://example.com/2')
    queue.enqueue('b3', 'https://example.com/3')
    queue.enqueue('b4', 'https://example.com/4')
    await new Promise((r) => setTimeout(r, 10))
    expect(fetchMock).toHaveBeenCalledTimes(3)
    await new Promise((r) => setTimeout(r, 80))
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('deduplicates same-id enqueues', () => {
    const fetchMock = vi.fn(() => new Promise(() => {}))
    const queue = new RevalidationQueue({ fetcher: fetchMock as never, maxConcurrent: 3 })
    queue.enqueue('b1', 'https://example.com/1')
    queue.enqueue('b1', 'https://example.com/1')
    queue.enqueue('b1', 'https://example.com/1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('invokes onResult callback per result', async () => {
    const results: Array<{ id: string; kind: string }> = []
    const fetchMock = vi.fn(async () => ({ kind: 'gone' as const }))
    const queue = new RevalidationQueue({
      fetcher: fetchMock as never,
      maxConcurrent: 3,
      onResult: (id, r) => { results.push({ id, kind: r.kind }) },
    })
    queue.enqueue('b1', 'https://example.com/dead')
    await new Promise((r) => setTimeout(r, 30))
    expect(results).toEqual([{ id: 'b1', kind: 'gone' }])
  })
})
