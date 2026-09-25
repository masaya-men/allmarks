import { describe, it, expect, afterEach } from 'vitest'
import { withSyncLock } from './sync-lock'

/** jsdom (this project's vitest environment) doesn't implement the Web Locks API, so
 *  `navigator.locks` is undefined by default here -- exercising the fallback path with no setup.
 *  Tests that need the primary path define it explicitly and restore it afterwards. */
afterEach(() => {
  Reflect.deleteProperty(navigator, 'locks')
})

describe('withSyncLock (fallback path, navigator.locks unavailable)', () => {
  it('runs a single call and returns its result', async () => {
    const result = await withSyncLock(async () => 'done')
    expect(result).toBe('done')
  })

  it('serializes two overlapping calls in order (second starts only after the first resolves)', async () => {
    const order: string[] = []
    let releaseFirst: () => void = () => {}
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve })

    const p1 = withSyncLock(async () => {
      order.push('first-start')
      await firstGate
      order.push('first-end')
      return 'r1'
    })
    const p2 = withSyncLock(async () => {
      order.push('second-start')
      return 'r2'
    })

    // Give the microtask queue a turn: p1 has started (it's synchronous up to the await), p2
    // must NOT have started yet because the lock is still held.
    await Promise.resolve()
    await Promise.resolve()
    expect(order).toEqual(['first-start'])

    releaseFirst()
    const [r1, r2] = await Promise.all([p1, p2])

    expect(order).toEqual(['first-start', 'first-end', 'second-start'])
    expect(r1).toBe('r1')
    expect(r2).toBe('r2')
  })

  it('the second call still runs after the first, even when the first throws', async () => {
    const order: string[] = []

    const p1 = withSyncLock(async () => {
      order.push('first')
      throw new Error('boom')
    })
    const p2 = withSyncLock(async () => {
      order.push('second')
      return 'ok'
    })

    await expect(p1).rejects.toThrow('boom')
    await expect(p2).resolves.toBe('ok')
    expect(order).toEqual(['first', 'second'])
  })

  it('does not deadlock across many sequential failures', async () => {
    for (let i = 0; i < 5; i++) {
      await expect(withSyncLock(async () => { throw new Error(`fail-${i}`) })).rejects.toThrow(`fail-${i}`)
    }
    await expect(withSyncLock(async () => 'still-works')).resolves.toBe('still-works')
  })
})

describe('withSyncLock (navigator.locks present)', () => {
  it('delegates to navigator.locks.request with the exclusive mode and a stable lock name', async () => {
    const request = async <T>(name: string, options: { mode: string }, fn: () => Promise<T>): Promise<T> => {
      expect(name).toBe('allmarks-sync-cycle')
      expect(options).toEqual({ mode: 'exclusive' })
      return fn()
    }
    Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true })

    const result = await withSyncLock(async () => 'via-web-locks')
    expect(result).toBe('via-web-locks')
  })

  it('serializes two calls through a mocked navigator.locks the same way a real exclusive lock would', async () => {
    // Minimal in-memory stand-in for the real API's exclusivity guarantee: only one `fn` runs at
    // a time, queued in call order.
    let queue: Promise<void> = Promise.resolve()
    const request = async <T>(_name: string, _options: unknown, fn: () => Promise<T>): Promise<T> => {
      const previous = queue
      let release: () => void = () => {}
      queue = new Promise((resolve) => { release = resolve })
      await previous
      try {
        return await fn()
      } finally {
        release()
      }
    }
    Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true })

    const order: string[] = []
    let releaseFirst: () => void = () => {}
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve })

    const p1 = withSyncLock(async () => {
      order.push('first-start')
      await firstGate
      order.push('first-end')
    })
    const p2 = withSyncLock(async () => {
      order.push('second-start')
    })

    await Promise.resolve()
    await Promise.resolve()
    expect(order).toEqual(['first-start'])

    releaseFirst()
    await Promise.all([p1, p2])
    expect(order).toEqual(['first-start', 'first-end', 'second-start'])
  })

  it('propagates a rejection from the callback without swallowing it', async () => {
    const request = async <T>(_name: string, _options: unknown, fn: () => Promise<T>): Promise<T> => fn()
    Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true })

    await expect(withSyncLock(async () => { throw new Error('web-locks-boom') })).rejects.toThrow('web-locks-boom')
  })
})
