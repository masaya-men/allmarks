import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SyncPanel } from './SyncPanel'
import { loadLicense } from '@/lib/board/license-store'
import { activateLicenseKey } from '@/lib/board/license-activate'
import { loadSyncStatus } from '@/lib/sync/sync-store'
import { runSyncCycle, connectSync } from '@/lib/sync/engine'
import { requestAuthCode, exchangeCode } from '@/lib/sync/auth'

vi.mock('@/lib/storage/indexeddb', () => ({ initDB: vi.fn().mockResolvedValue({}) }))
vi.mock('@/lib/board/license-store', () => ({ loadLicense: vi.fn() }))
vi.mock('@/lib/board/license-activate', () => ({ activateLicenseKey: vi.fn() }))
vi.mock('@/lib/sync/sync-store', () => ({ loadSyncStatus: vi.fn() }))
vi.mock('@/lib/sync/engine', () => ({ runSyncCycle: vi.fn(), connectSync: vi.fn() }))
vi.mock('@/lib/sync/auth', () => ({ requestAuthCode: vi.fn(), exchangeCode: vi.fn() }))

const mockLoadLicense = vi.mocked(loadLicense)
const mockActivate = vi.mocked(activateLicenseKey)
const mockLoadSyncStatus = vi.mocked(loadSyncStatus)
const mockRunSyncCycle = vi.mocked(runSyncCycle)
const mockConnectSync = vi.mocked(connectSync)
const mockRequestAuthCode = vi.mocked(requestAuthCode)
const mockExchangeCode = vi.mocked(exchangeCode)

describe('SyncPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadSyncStatus.mockResolvedValue({ connected: false, headRevisions: {} })
  })

  it('shows the locked view (explanation, disabled supporter link, key input) when not unlocked', async () => {
    mockLoadLicense.mockResolvedValue(null)
    render(<SyncPanel />)
    await screen.findByTestId('sync-locked')
    expect(screen.getByTestId('sync-become-supporter')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByTestId('sync-key-submit')).toBeDisabled()
  })

  it('shows the unlocked view directly when already unlocked on load', async () => {
    mockLoadLicense.mockResolvedValue({ kid: 'k1', deviceId: 'd1', scope: ['sync'], validatedAt: 1 })
    render(<SyncPanel />)
    await screen.findByTestId('sync-unlocked')
    expect(screen.queryByTestId('sync-locked')).not.toBeInTheDocument()
  })

  it('enables the unlock button once a key is typed', async () => {
    mockLoadLicense.mockResolvedValue(null)
    render(<SyncPanel />)
    await screen.findByTestId('sync-locked')
    fireEvent.change(screen.getByTestId('sync-key-input'), { target: { value: 'abc' } })
    expect(screen.getByTestId('sync-key-submit')).not.toBeDisabled()
  })

  it('strips internal whitespace from the pasted key before activating', async () => {
    mockLoadLicense.mockResolvedValue(null)
    mockActivate.mockResolvedValue({ status: 'invalid-key' })
    render(<SyncPanel />)
    await screen.findByTestId('sync-locked')
    fireEvent.change(screen.getByTestId('sync-key-input'), { target: { value: 'ab \n cd\t ef' } })
    fireEvent.click(screen.getByTestId('sync-key-submit'))
    await waitFor(() => expect(mockActivate).toHaveBeenCalledWith(expect.anything(), 'abcdef'))
  })

  it('shows the invalid-key error message and stays locked', async () => {
    mockLoadLicense.mockResolvedValue(null)
    mockActivate.mockResolvedValue({ status: 'invalid-key' })
    render(<SyncPanel />)
    await screen.findByTestId('sync-locked')
    fireEvent.change(screen.getByTestId('sync-key-input'), { target: { value: 'bad-key' } })
    fireEvent.click(screen.getByTestId('sync-key-submit'))
    await waitFor(() => expect(screen.getByTestId('sync-key-error')).toHaveTextContent(/valid/i))
    expect(screen.getByTestId('sync-locked')).toBeInTheDocument()
  })

  it('shows the unsupported-browser error message', async () => {
    mockLoadLicense.mockResolvedValue(null)
    mockActivate.mockResolvedValue({ status: 'unsupported' })
    render(<SyncPanel />)
    await screen.findByTestId('sync-locked')
    fireEvent.change(screen.getByTestId('sync-key-input'), { target: { value: 'some-key' } })
    fireEvent.click(screen.getByTestId('sync-key-submit'))
    await waitFor(() => expect(screen.getByTestId('sync-key-error')).toHaveTextContent(/browser/i))
  })

  it('shows the cap-exceeded error message with a contact link', async () => {
    mockLoadLicense.mockResolvedValue(null)
    mockActivate.mockResolvedValue({ status: 'cap-exceeded' })
    render(<SyncPanel />)
    await screen.findByTestId('sync-locked')
    fireEvent.change(screen.getByTestId('sync-key-input'), { target: { value: 'some-key' } })
    fireEvent.click(screen.getByTestId('sync-key-submit'))
    await waitFor(() => expect(screen.getByTestId('sync-cap-exceeded-contact')).toBeInTheDocument())
    expect(screen.getByTestId('sync-cap-exceeded-contact')).toHaveAttribute('href', '/contact')
  })

  it('switches to the unlocked view after a successful activation', async () => {
    mockLoadLicense.mockResolvedValue(null)
    mockActivate.mockResolvedValue({ status: 'unlocked', scope: ['sync'], verified: true })
    render(<SyncPanel />)
    await screen.findByTestId('sync-locked')
    fireEvent.change(screen.getByTestId('sync-key-input'), { target: { value: 'good-key' } })
    fireEvent.click(screen.getByTestId('sync-key-submit'))
    await screen.findByTestId('sync-unlocked')
    expect(screen.queryByTestId('sync-locked')).not.toBeInTheDocument()
  })

  it('falls back to the locked view (not a permanent blank) if reading the license state throws', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockLoadLicense.mockRejectedValue(new Error('indexedDB unavailable'))
    render(<SyncPanel />)
    await screen.findByTestId('sync-locked')
    consoleErrorSpy.mockRestore()
  })

  it('shows a generic error and re-enables the button if activation itself throws', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockLoadLicense.mockResolvedValue(null)
    mockActivate.mockRejectedValue(new Error('indexedDB unavailable'))
    render(<SyncPanel />)
    await screen.findByTestId('sync-locked')
    fireEvent.change(screen.getByTestId('sync-key-input'), { target: { value: 'some-key' } })
    fireEvent.click(screen.getByTestId('sync-key-submit'))
    await waitFor(() => expect(screen.getByTestId('sync-key-error')).toHaveTextContent(/activate/i))
    expect(screen.getByTestId('sync-key-submit')).not.toBeDisabled()
    consoleErrorSpy.mockRestore()
  })
})

describe('SyncPanel connected states', () => {
  beforeEach(() => {
    // Sibling describe block, so it doesn't inherit the `describe('SyncPanel')`
    // beforeEach above — clear here too so mock.calls counts (e.g.
    // mockRunSyncCycle) don't leak across tests within this block.
    vi.clearAllMocks()
    mockLoadLicense.mockResolvedValue({ kid: 'k1', deviceId: 'd1', scope: ['sync'], validatedAt: 1 })
  })

  it('shows the connect explanation and button when unlocked but not connected', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: false, headRevisions: {} })
    render(<SyncPanel />)
    await screen.findByTestId('sync-connect-button')
  })

  it('stays on the connect flow (not the locked paywall) if the status read fails after an already-unlocked license read', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockLoadSyncStatus.mockRejectedValue(new Error('indexedDB transaction error'))
    render(<SyncPanel />)
    await screen.findByTestId('sync-connect-button')
    expect(screen.queryByTestId('sync-locked')).not.toBeInTheDocument()
    consoleErrorSpy.mockRestore()
  })

  it('connects: requests a code, exchanges it, calls connectSync, and shows the idle connected view', async () => {
    mockRequestAuthCode.mockResolvedValue('auth-code')
    mockExchangeCode.mockResolvedValue({ accessToken: 'at', expiresAt: Date.now() + 100000, scope: 'drive.file' })
    mockConnectSync.mockResolvedValue({ status: 'synced', vaultConflict: false })
    // First call = initial mount (disconnected). Second call = applyResult's re-read after
    // connectSync resolves 'synced', to pick up the fresh connectedEmail/lastSyncAt.
    mockLoadSyncStatus
      .mockResolvedValueOnce({ connected: false, headRevisions: {} })
      .mockResolvedValueOnce({ connected: true, headRevisions: {}, connectedEmail: 'user@example.com', lastSyncAt: Date.now() })
    render(<SyncPanel />)
    await screen.findByTestId('sync-connect-button')
    fireEvent.click(screen.getByTestId('sync-connect-button'))
    await screen.findByTestId('sync-connected-status')
    expect(mockRequestAuthCode).toHaveBeenCalledTimes(1)
    expect(mockExchangeCode).toHaveBeenCalledWith('auth-code')
    expect(mockConnectSync).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('sync-connected-status').textContent).toContain('user@example.com')
  })

  it('shows connectFailed and the button again if requestAuthCode rejects (popup closed/cancelled)', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: false, headRevisions: {} })
    mockRequestAuthCode.mockRejectedValue(new Error('popup closed'))
    render(<SyncPanel />)
    await screen.findByTestId('sync-connect-button')
    fireEvent.click(screen.getByTestId('sync-connect-button'))
    await screen.findByTestId('sync-connect-error')
    expect(screen.getByTestId('sync-connect-button')).toBeInTheDocument()
  })

  it('shows the idle connected view with last-synced text and a working sync-now button', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, connectedEmail: 'user@example.com', lastSyncAt: Date.now() - 5 * 60_000 })
    mockRunSyncCycle.mockResolvedValue({ status: 'synced', vaultConflict: false })
    render(<SyncPanel />)
    await screen.findByTestId('sync-connected-status')
    expect(screen.getByTestId('sync-last-synced').textContent).toMatch(/5/)
    fireEvent.click(screen.getByTestId('sync-now-button'))
    await waitFor(() => expect(mockRunSyncCycle).toHaveBeenCalledTimes(1))
  })

  it('shows the SyncMassDeleteConfirmDialog when a manual sync returns needs-confirmation', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, connectedEmail: 'user@example.com', lastSyncAt: Date.now() })
    mockRunSyncCycle.mockResolvedValue({ status: 'needs-confirmation', vaultConflict: false, deletedCount: 12 })
    render(<SyncPanel />)
    await screen.findByTestId('sync-now-button')
    fireEvent.click(screen.getByTestId('sync-now-button'))
    await screen.findByTestId('sync-mass-delete-dialog')
    expect(screen.getByTestId('sync-mass-delete-dialog').textContent).toContain('12')
  })

  it('CONTINUE on the mass-delete dialog re-runs the cycle with bypassMassDeleteGuard', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, connectedEmail: 'user@example.com', lastSyncAt: Date.now() })
    mockRunSyncCycle
      .mockResolvedValueOnce({ status: 'needs-confirmation', vaultConflict: false, deletedCount: 12 })
      .mockResolvedValueOnce({ status: 'synced', vaultConflict: false })
    render(<SyncPanel />)
    await screen.findByTestId('sync-now-button')
    fireEvent.click(screen.getByTestId('sync-now-button'))
    await screen.findByTestId('sync-mass-delete-dialog')
    fireEvent.click(screen.getByTestId('sync-mass-delete-continue'))
    await waitFor(() => expect(mockRunSyncCycle).toHaveBeenCalledTimes(2))
    expect(mockRunSyncCycle).toHaveBeenLastCalledWith(expect.anything(), { bypassMassDeleteGuard: true })
  })

  it('shows the reconnect button and copy when the persisted lastIssue is an auth error', async () => {
    mockLoadSyncStatus.mockResolvedValue({
      connected: true, headRevisions: {}, connectedEmail: 'user@example.com',
      lastIssue: { kind: 'error', errorKind: 'auth' },
    })
    render(<SyncPanel />)
    await screen.findByTestId('sync-reconnect-button')
    expect(screen.getByTestId('sync-issue').textContent).toMatch(/reconnect|再接続|接続が切れました/i)
  })

  it('shows the storage-full message with a retry (sync-now) button', async () => {
    mockLoadSyncStatus.mockResolvedValue({
      connected: true, headRevisions: {}, connectedEmail: 'user@example.com',
      lastIssue: { kind: 'error', errorKind: 'storage-full' },
    })
    render(<SyncPanel />)
    await screen.findByTestId('sync-now-button')
    expect(screen.getByTestId('sync-issue')).toBeInTheDocument()
  })
})
