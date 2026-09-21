import { describe, it, expect, afterEach } from 'vitest'
import { setSyncMarkDirty, notifySyncDirty, withSyncWritesSuppressed } from './sync-signal'

afterEach(() => { setSyncMarkDirty(null) })

describe('notifySyncDirty', () => {
  it('does nothing when no controller is registered', () => {
    expect(() => notifySyncDirty()).not.toThrow()
  })

  it('calls the registered markDirty function', () => {
    let calls = 0
    setSyncMarkDirty(() => { calls++ })
    notifySyncDirty()
    expect(calls).toBe(1)
  })

  it('stops calling markDirty after it is unregistered', () => {
    let calls = 0
    setSyncMarkDirty(() => { calls++ })
    setSyncMarkDirty(null)
    notifySyncDirty()
    expect(calls).toBe(0)
  })
})

describe('withSyncWritesSuppressed', () => {
  it('suppresses notifySyncDirty calls made during the wrapped function', async () => {
    let calls = 0
    setSyncMarkDirty(() => { calls++ })
    await withSyncWritesSuppressed(async () => {
      notifySyncDirty()
      notifySyncDirty()
    })
    expect(calls).toBe(0)
  })

  it('resumes notifying once the wrapped function settles', async () => {
    let calls = 0
    setSyncMarkDirty(() => { calls++ })
    await withSyncWritesSuppressed(async () => { notifySyncDirty() })
    notifySyncDirty()
    expect(calls).toBe(1)
  })

  it('stays suppressed across nested calls until the outermost one resolves', async () => {
    let calls = 0
    setSyncMarkDirty(() => { calls++ })
    await withSyncWritesSuppressed(async () => {
      await withSyncWritesSuppressed(async () => { notifySyncDirty() })
      notifySyncDirty() // still inside the outer suppression
    })
    expect(calls).toBe(0)
    notifySyncDirty()
    expect(calls).toBe(1)
  })

  it('un-suppresses even if the wrapped function throws', async () => {
    let calls = 0
    setSyncMarkDirty(() => { calls++ })
    await expect(withSyncWritesSuppressed(async () => { throw new Error('boom') })).rejects.toThrow('boom')
    notifySyncDirty()
    expect(calls).toBe(1)
  })
})
