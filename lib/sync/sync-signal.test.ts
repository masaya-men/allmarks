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

describe('withSyncWritesSuppressed (handle-scoped — what runSyncCycle uses)', () => {
  it('ignores writes made through the suppressed handle while the wrapped function runs', async () => {
    let calls = 0
    setSyncMarkDirty(() => { calls++ })
    const cycleDb = {}
    await withSyncWritesSuppressed(async () => {
      notifySyncDirty(cycleDb)
      notifySyncDirty(cycleDb)
    }, cycleDb)
    expect(calls).toBe(0)
    notifySyncDirty(cycleDb) // after the window: a normal write again
    expect(calls).toBe(1)
  })

  it('still delivers a user write made through another handle during the cycle (never dropped)', async () => {
    let calls = 0
    setSyncMarkDirty(() => { calls++ })
    const cycleDb = {}
    const userDb = {}
    await withSyncWritesSuppressed(async () => {
      notifySyncDirty(userDb)
      expect(calls).toBe(1)
    }, cycleDb)
    expect(calls).toBe(1)
  })

  it('stays suppressed across nested calls on the same handle until the outermost one resolves', async () => {
    let calls = 0
    setSyncMarkDirty(() => { calls++ })
    const cycleDb = {}
    await withSyncWritesSuppressed(async () => {
      await withSyncWritesSuppressed(async () => { notifySyncDirty(cycleDb) }, cycleDb)
      notifySyncDirty(cycleDb)
    }, cycleDb)
    expect(calls).toBe(0)
  })

  it('un-suppresses the handle even if the wrapped function throws', async () => {
    let calls = 0
    setSyncMarkDirty(() => { calls++ })
    const cycleDb = {}
    await expect(withSyncWritesSuppressed(async () => { throw new Error('boom') }, cycleDb)).rejects.toThrow('boom')
    notifySyncDirty(cycleDb)
    expect(calls).toBe(1)
  })
})

describe('withSyncWritesSuppressed (legacy, no handle)', () => {
  it('holds notifications back during the wrapped function and delivers them once afterwards (queued, not dropped)', async () => {
    let calls = 0
    setSyncMarkDirty(() => { calls++ })
    await withSyncWritesSuppressed(async () => {
      notifySyncDirty()
      notifySyncDirty()
      expect(calls).toBe(0)
    })
    expect(calls).toBe(1)
  })

  it('delivers nothing afterwards when nothing was written', async () => {
    let calls = 0
    setSyncMarkDirty(() => { calls++ })
    await withSyncWritesSuppressed(async () => undefined)
    expect(calls).toBe(0)
  })

  it('waits for the outermost nested call before delivering', async () => {
    let calls = 0
    setSyncMarkDirty(() => { calls++ })
    await withSyncWritesSuppressed(async () => {
      await withSyncWritesSuppressed(async () => { notifySyncDirty() })
      expect(calls).toBe(0)
    })
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
