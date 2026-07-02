import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { repostTickDecision, startRepostPump } from '../../extension/lib/offscreen-repost.js'

// N-15: the offscreen→iframe bridge must keep re-posting the save envelope
// until the (React) iframe has hydrated and its `message` listener answers.
// A window.postMessage to a not-yet-listening window is dropped (not buffered),
// so a single post is lost on a cold start and the first save after a browser
// restart fails. The iframe dedupes by nonce, so re-posting never double-saves.

describe('repostTickDecision', () => {
  it('stops as soon as the iframe answered (nonce no longer pending)', () => {
    expect(repostTickDecision({ pending: false, elapsedMs: 250, deadlineMs: 8000 })).toBe('stop')
  })

  it('an answer wins over the deadline (stop, not timeout)', () => {
    expect(repostTickDecision({ pending: false, elapsedMs: 9000, deadlineMs: 8000 })).toBe('stop')
  })

  it('re-posts while still pending and under the deadline', () => {
    expect(repostTickDecision({ pending: true, elapsedMs: 250, deadlineMs: 8000 })).toBe('repost')
  })

  it('times out when still pending at the deadline', () => {
    expect(repostTickDecision({ pending: true, elapsedMs: 8000, deadlineMs: 8000 })).toBe('timeout')
  })

  it('times out when still pending past the deadline', () => {
    expect(repostTickDecision({ pending: true, elapsedMs: 8250, deadlineMs: 8000 })).toBe('timeout')
  })
})

describe('startRepostPump', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('posts immediately, then re-posts each interval until the iframe answers', () => {
    let pending = true
    const post = vi.fn()
    const onTimeout = vi.fn()
    startRepostPump({ post, isPending: () => pending, onTimeout, intervalMs: 250, deadlineMs: 8000 })

    // Immediate first attempt (this is the one dropped on a cold start).
    expect(post).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(250)
    expect(post).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(250)
    expect(post).toHaveBeenCalledTimes(3)

    // The iframe hydrated and answered → its nonce leaves the router.
    pending = false
    vi.advanceTimersByTime(250)
    expect(post).toHaveBeenCalledTimes(3) // no further posts
    expect(onTimeout).not.toHaveBeenCalled()

    // Loop is fully stopped — no leaked interval.
    vi.advanceTimersByTime(5000)
    expect(post).toHaveBeenCalledTimes(3)
    expect(onTimeout).not.toHaveBeenCalled()
  })

  it('fires onTimeout exactly once when the iframe never answers', () => {
    const post = vi.fn()
    const onTimeout = vi.fn()
    startRepostPump({ post, isPending: () => true, onTimeout, intervalMs: 250, deadlineMs: 1000 })

    vi.advanceTimersByTime(1000) // ticks at 250/500/750 repost, 1000 → timeout
    expect(onTimeout).toHaveBeenCalledTimes(1)
    const postsAtTimeout = post.mock.calls.length

    // After timeout the pump is stopped: no more posts, no second timeout.
    vi.advanceTimersByTime(4000)
    expect(post.mock.calls.length).toBe(postsAtTimeout)
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })

  it('cancel() stops the pump before any interval tick', () => {
    const post = vi.fn()
    const onTimeout = vi.fn()
    const cancel = startRepostPump({ post, isPending: () => true, onTimeout, intervalMs: 250, deadlineMs: 8000 })

    cancel()
    vi.advanceTimersByTime(4000)
    expect(post).toHaveBeenCalledTimes(1) // only the immediate post
    expect(onTimeout).not.toHaveBeenCalled()
  })
})
