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
})
