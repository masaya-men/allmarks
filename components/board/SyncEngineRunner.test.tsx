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
})
