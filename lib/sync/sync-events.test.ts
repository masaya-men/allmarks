import { describe, it, expect } from 'vitest'
import { notifySyncCycleFinished, onSyncCycleFinished } from './sync-events'

describe('sync-events pub/sub', () => {
  it('does nothing when no listener is registered', () => {
    expect(() => notifySyncCycleFinished()).not.toThrow()
  })

  it('calls a registered listener', () => {
    let calls = 0
    const unsubscribe = onSyncCycleFinished(() => { calls++ })
    notifySyncCycleFinished()
    expect(calls).toBe(1)
    unsubscribe()
  })

  it('calls every registered listener, in no particular guaranteed order', () => {
    let a = 0
    let b = 0
    const unsubA = onSyncCycleFinished(() => { a++ })
    const unsubB = onSyncCycleFinished(() => { b++ })
    notifySyncCycleFinished()
    expect(a).toBe(1)
    expect(b).toBe(1)
    unsubA()
    unsubB()
  })

  it('stops calling a listener after it unsubscribes', () => {
    let calls = 0
    const unsubscribe = onSyncCycleFinished(() => { calls++ })
    unsubscribe()
    notifySyncCycleFinished()
    expect(calls).toBe(0)
  })

  it('unsubscribing one listener does not affect another', () => {
    let a = 0
    let b = 0
    const unsubA = onSyncCycleFinished(() => { a++ })
    const unsubB = onSyncCycleFinished(() => { b++ })
    unsubA()
    notifySyncCycleFinished()
    expect(a).toBe(0)
    expect(b).toBe(1)
    unsubB()
  })
})
