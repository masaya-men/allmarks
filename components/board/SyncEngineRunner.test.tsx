import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { SyncEngineRunner } from './SyncEngineRunner'
import { loadSyncStatus } from '@/lib/sync/sync-store'
import { createSyncController } from '@/lib/sync/sync-controller'

vi.mock('@/lib/storage/indexeddb', () => ({ initDB: vi.fn().mockResolvedValue({}) }))
vi.mock('@/lib/sync/sync-store', () => ({ loadSyncStatus: vi.fn() }))
vi.mock('@/lib/sync/sync-controller', () => ({ createSyncController: vi.fn() }))

const mockLoadSyncStatus = vi.mocked(loadSyncStatus)
const mockCreateSyncController = vi.mocked(createSyncController)

function fakeController() {
  return { start: vi.fn(), stop: vi.fn(), markDirty: vi.fn(), flushNow: vi.fn().mockResolvedValue({ status: 'synced', vaultConflict: false }) }
}

describe('SyncEngineRunner', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('does nothing when sync is not connected', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: false, headRevisions: {} })
    render(<SyncEngineRunner />)
    await vi.waitFor(() => expect(mockLoadSyncStatus).toHaveBeenCalled())
    expect(mockCreateSyncController).not.toHaveBeenCalled()
  })

  it('starts the controller and flushes once on launch when already connected', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, folderId: 'f1' })
    const controller = fakeController()
    mockCreateSyncController.mockReturnValue(controller)
    render(<SyncEngineRunner />)
    await vi.waitFor(() => expect(controller.start).toHaveBeenCalledTimes(1))
    expect(controller.flushNow).toHaveBeenCalledTimes(1)
  })

  it('renders nothing', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: false, headRevisions: {} })
    const { container } = render(<SyncEngineRunner />)
    await vi.waitFor(() => expect(mockLoadSyncStatus).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('stops the controller on unmount', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, folderId: 'f1' })
    const controller = fakeController()
    mockCreateSyncController.mockReturnValue(controller)
    const { unmount } = render(<SyncEngineRunner />)
    await vi.waitFor(() => expect(controller.start).toHaveBeenCalledTimes(1))
    unmount()
    expect(controller.stop).toHaveBeenCalledTimes(1)
  })

  it('does not react to a visibilitychange after unmount', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, folderId: 'f1' })
    const controller = fakeController()
    mockCreateSyncController.mockReturnValue(controller)

    const { unmount } = render(<SyncEngineRunner />)
    await vi.waitFor(() => expect(controller.start).toHaveBeenCalledTimes(1))
    expect(controller.flushNow).toHaveBeenCalledTimes(1) // mount-time flush only, so far

    unmount()
    expect(controller.stop).toHaveBeenCalledTimes(1)

    // The visibilitychange listener is removed on unmount, so this must not reach controller at all.
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(controller.flushNow).toHaveBeenCalledTimes(1)
  })

  // Item: "sooner pickup" — no more 5-minute revisit gap. Every return to the tab triggers an
  // immediate skip-if-unchanged flush (cheap: no downloads unless something actually changed).
  it('flushes immediately with skipIfUnchanged the instant the tab becomes visible again', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, folderId: 'f1' })
    const controller = fakeController()
    mockCreateSyncController.mockReturnValue(controller)
    render(<SyncEngineRunner />)
    await vi.waitFor(() => expect(controller.start).toHaveBeenCalledTimes(1))
    expect(controller.flushNow).toHaveBeenCalledTimes(1) // mount-time flush only, so far

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(controller.flushNow).toHaveBeenCalledTimes(1) // going hidden never flushes

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.waitFor(() => expect(controller.flushNow).toHaveBeenCalledTimes(2))
    expect(controller.flushNow).toHaveBeenLastCalledWith({ skipIfUnchanged: true })
  })

  // Item: 30s poll while visible, paused while hidden, cleared on unmount.
  it('polls every 30s while visible, pauses while hidden, and stops on unmount', async () => {
    vi.useFakeTimers()
    try {
      mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, folderId: 'f1' })
      const controller = fakeController()
      mockCreateSyncController.mockReturnValue(controller)
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })

      const { unmount } = render(<SyncEngineRunner />)
      await vi.waitFor(() => expect(controller.start).toHaveBeenCalledTimes(1))
      expect(controller.flushNow).toHaveBeenCalledTimes(1) // mount-time full flush

      await vi.advanceTimersByTimeAsync(30_000)
      expect(controller.flushNow).toHaveBeenCalledTimes(2)
      expect(controller.flushNow).toHaveBeenLastCalledWith({ skipIfUnchanged: true })

      await vi.advanceTimersByTimeAsync(30_000)
      expect(controller.flushNow).toHaveBeenCalledTimes(3)

      // Hidden: polling pauses.
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.advanceTimersByTimeAsync(90_000)
      expect(controller.flushNow).toHaveBeenCalledTimes(3)

      // Visible again: immediate flush + polling resumes.
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
      expect(controller.flushNow).toHaveBeenCalledTimes(4)
      await vi.advanceTimersByTimeAsync(30_000)
      expect(controller.flushNow).toHaveBeenCalledTimes(5)

      unmount()
      await vi.advanceTimersByTimeAsync(90_000)
      expect(controller.flushNow).toHaveBeenCalledTimes(5) // no more polls post-unmount
    } finally {
      vi.useRealTimers()
    }
  })

  // Item 4: some Drive fetches fail as a genuine browser-level network error (CORS/
  // net::ERR_FAILED when truly offline) with nothing listening for the browser telling us
  // connectivity came back — this is that listener.
  it('flushes immediately when the browser reports it is back online', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, folderId: 'f1' })
    const controller = fakeController()
    mockCreateSyncController.mockReturnValue(controller)
    render(<SyncEngineRunner />)
    await vi.waitFor(() => expect(controller.start).toHaveBeenCalledTimes(1))
    expect(controller.flushNow).toHaveBeenCalledTimes(1) // mount-time flush only, so far

    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(controller.flushNow).toHaveBeenCalledTimes(2))
  })

  it('ignores an online event before the controller exists (not yet connected)', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: false, headRevisions: {} })
    render(<SyncEngineRunner />)
    await vi.waitFor(() => expect(mockLoadSyncStatus).toHaveBeenCalled())
    expect(() => window.dispatchEvent(new Event('online'))).not.toThrow()
    expect(mockCreateSyncController).not.toHaveBeenCalled()
  })

  it('removes the online listener on unmount', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, folderId: 'f1' })
    const controller = fakeController()
    mockCreateSyncController.mockReturnValue(controller)
    const { unmount } = render(<SyncEngineRunner />)
    await vi.waitFor(() => expect(controller.start).toHaveBeenCalledTimes(1))
    unmount()
    window.dispatchEvent(new Event('online'))
    expect(controller.flushNow).toHaveBeenCalledTimes(1) // mount-time flush only — online ignored post-unmount
  })
})
