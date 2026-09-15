import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('./engine', () => ({ runSyncCycle: vi.fn().mockResolvedValue({ status: 'synced', vaultConflict: false }) }))
import { runSyncCycle } from './engine'
import { createSyncController } from './sync-controller'

const fakeDb = {} as never

beforeEach(() => { vi.useFakeTimers(); vi.mocked(runSyncCycle).mockClear() })
afterEach(() => { vi.useRealTimers() })

describe('createSyncController', () => {
  it('markDirty triggers a sync cycle after the debounce delay', async () => {
    const controller = createSyncController(fakeDb, 20000)
    controller.markDirty()
    expect(runSyncCycle).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(20000)
    expect(runSyncCycle).toHaveBeenCalledTimes(1)
  })

  it('repeated markDirty calls reset the timer (only one cycle fires)', async () => {
    const controller = createSyncController(fakeDb, 20000)
    controller.markDirty()
    await vi.advanceTimersByTimeAsync(15000)
    controller.markDirty()
    await vi.advanceTimersByTimeAsync(15000)
    expect(runSyncCycle).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(5000)
    expect(runSyncCycle).toHaveBeenCalledTimes(1)
  })

  it('flushNow runs immediately and cancels a pending debounce timer', async () => {
    const controller = createSyncController(fakeDb, 20000)
    controller.markDirty()
    await controller.flushNow()
    expect(runSyncCycle).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(20000)
    expect(runSyncCycle).toHaveBeenCalledTimes(1) // the debounced timer did not also fire
  })

  it('start() flushes on visibilitychange -> hidden', async () => {
    const controller = createSyncController(fakeDb, 20000)
    controller.start()
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()
    expect(runSyncCycle).toHaveBeenCalledTimes(1)
    controller.stop()
  })

  it('stop() removes listeners so a later visibilitychange does not flush', async () => {
    const controller = createSyncController(fakeDb, 20000)
    controller.start()
    controller.stop()
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()
    expect(runSyncCycle).not.toHaveBeenCalled()
  })

  it('beforeunload triggers a best-effort flush while started', async () => {
    const controller = createSyncController(fakeDb, 20000)
    controller.start()
    window.dispatchEvent(new Event('beforeunload'))
    await Promise.resolve()
    expect(runSyncCycle).toHaveBeenCalledTimes(1)
    controller.stop()
  })

  // Fix I-4: previously nothing guarded against overlapping flushNow() calls — e.g. a
  // visibilitychange firing while the debounce timer's own flushNow() call was still mid-flight
  // (a Drive round-trip takes real time) could start two concurrent runSyncCycle calls. Calling
  // flushNow() twice without awaiting the first must share one in-flight cycle.
  it('two overlapping flushNow() calls share one in-flight runSyncCycle and resolve to the same result', async () => {
    const controller = createSyncController(fakeDb, 20000)
    const p1 = controller.flushNow()
    const p2 = controller.flushNow()
    const [r1, r2] = await Promise.all([p1, p2])
    expect(runSyncCycle).toHaveBeenCalledTimes(1)
    expect(r1).toBe(r2)
  })

  it('a flushNow() call after the in-flight cycle settles starts a fresh cycle', async () => {
    const controller = createSyncController(fakeDb, 20000)
    await controller.flushNow()
    await controller.flushNow()
    expect(runSyncCycle).toHaveBeenCalledTimes(2)
  })

  // Fix I-3: flushNow()'s result used to be discarded (`void flushNow()`) on 3 of 4 trigger paths
  // (debounce timer, visibilitychange, beforeunload) — so the bundle's two headline safety-valve
  // outcomes (needs-confirmation, vaultConflict:true) never reached any caller on an automatic
  // trigger. onResult must fire exactly once per actual cycle, including when triggered by the
  // debounce timer (not just an explicit manual flushNow()).
  it('onResult fires exactly once with the cycle result when triggered automatically via the debounce timer', async () => {
    const onResult = vi.fn()
    const result = { status: 'needs-confirmation' as const, vaultConflict: true, deletionRatio: 0.9 }
    vi.mocked(runSyncCycle).mockResolvedValueOnce(result)
    const controller = createSyncController(fakeDb, 20000, onResult)

    controller.markDirty()
    await vi.advanceTimersByTimeAsync(20000)

    expect(runSyncCycle).toHaveBeenCalledTimes(1)
    expect(onResult).toHaveBeenCalledTimes(1)
    expect(onResult).toHaveBeenCalledWith(result)
  })

  it('onResult fires exactly once per manual flushNow() cycle too', async () => {
    const onResult = vi.fn()
    const controller = createSyncController(fakeDb, 20000, onResult)
    await controller.flushNow()
    expect(onResult).toHaveBeenCalledTimes(1)
    expect(onResult).toHaveBeenCalledWith({ status: 'synced', vaultConflict: false })
  })
})
