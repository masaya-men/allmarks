import { describe, it, expect } from 'vitest'
import {
  notifySyncCycleFinished, onSyncCycleFinished,
  notifySyncCycleStarted, onSyncCycleStarted, isSyncCycleInFlight,
} from './sync-events'

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

describe('sync-events started pub/sub', () => {
  it('does nothing when no listener is registered', () => {
    expect(() => notifySyncCycleStarted()).not.toThrow()
    notifySyncCycleFinished() // balance the counter for isolation from later tests
  })

  it('calls a registered started listener', () => {
    let calls = 0
    const unsubscribe = onSyncCycleStarted(() => { calls++ })
    notifySyncCycleStarted()
    expect(calls).toBe(1)
    unsubscribe()
    notifySyncCycleFinished() // balance the counter
  })

  it('started and finished listeners are independent pub/sub channels', () => {
    let startedCalls = 0
    let finishedCalls = 0
    const unsubStart = onSyncCycleStarted(() => { startedCalls++ })
    const unsubFinish = onSyncCycleFinished(() => { finishedCalls++ })
    notifySyncCycleStarted()
    expect(startedCalls).toBe(1)
    expect(finishedCalls).toBe(0)
    notifySyncCycleFinished()
    expect(finishedCalls).toBe(1)
    unsubStart(); unsubFinish()
  })
})

// isSyncCycleInFlight() is a counter under the hood (not a boolean), specifically so overlapping
// or queued cycles (sync-lock.ts serializes them, but engine.ts's runSyncCycle can still be called
// again before the first settles) report "in flight" until every started() has a matching
// finished() -- and it must never go negative, so a stray extra finished() can't leave it stuck
// reporting true (or throw).
describe('isSyncCycleInFlight (counter semantics)', () => {
  it('is false with no activity', () => {
    expect(isSyncCycleInFlight()).toBe(false)
  })

  it('is true after started(), false again after the matching finished()', () => {
    notifySyncCycleStarted()
    expect(isSyncCycleInFlight()).toBe(true)
    notifySyncCycleFinished()
    expect(isSyncCycleInFlight()).toBe(false)
  })

  it('stays true across two overlapping started() calls until both have a matching finished()', () => {
    notifySyncCycleStarted()
    notifySyncCycleStarted()
    expect(isSyncCycleInFlight()).toBe(true)
    notifySyncCycleFinished()
    expect(isSyncCycleInFlight()).toBe(true) // one of the two cycles is still running
    notifySyncCycleFinished()
    expect(isSyncCycleInFlight()).toBe(false)
  })

  it('never goes negative: an extra finished() with no matching started() leaves it at false, not stuck true', () => {
    notifySyncCycleFinished()
    notifySyncCycleFinished()
    expect(isSyncCycleInFlight()).toBe(false)
    notifySyncCycleStarted()
    expect(isSyncCycleInFlight()).toBe(true)
    notifySyncCycleFinished()
    expect(isSyncCycleInFlight()).toBe(false)
  })
})
