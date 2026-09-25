import { createRef } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { SyncPanel, type SyncPanelHandle } from './SyncPanel'
import { loadLicense } from '@/lib/board/license-store'
import { activateLicenseKey, fetchDeviceCount, registerDeviceLabel, releaseDevice } from '@/lib/board/license-activate'
import { loadSyncStatus } from '@/lib/sync/sync-store'
import { runSyncCycle, connectSync } from '@/lib/sync/engine'
import { requestAuthCode, exchangeCode } from '@/lib/sync/auth'
import { checkLicenseForSync } from '@/lib/board/license-check'
import { notifySyncCycleFinished, notifySyncCycleStarted } from '@/lib/sync/sync-events'
import { setSyncMarkDirty, notifySyncDirty, withSyncWritesSuppressed } from '@/lib/sync/sync-signal'

vi.mock('@/lib/storage/indexeddb', () => ({
  initDB: vi.fn().mockResolvedValue({}),
  getRecentSyncedWrites: vi.fn().mockReturnValue([]),
}))
vi.mock('@/lib/board/license-store', () => ({ loadLicense: vi.fn() }))
vi.mock('@/lib/board/license-activate', () => ({
  activateLicenseKey: vi.fn(), fetchDeviceCount: vi.fn().mockResolvedValue(null), releaseDevice: vi.fn(),
  registerDeviceLabel: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/sync/sync-store', () => ({ loadSyncStatus: vi.fn() }))
vi.mock('@/lib/sync/engine', () => ({ runSyncCycle: vi.fn(), connectSync: vi.fn() }))
vi.mock('@/lib/sync/auth', () => ({ requestAuthCode: vi.fn(), exchangeCode: vi.fn() }))
vi.mock('@/lib/board/license-check', () => ({ checkLicenseForSync: vi.fn() }))

const mockLoadLicense = vi.mocked(loadLicense)
const mockActivate = vi.mocked(activateLicenseKey)
const mockFetchDeviceCount = vi.mocked(fetchDeviceCount)
const mockRegisterDeviceLabel = vi.mocked(registerDeviceLabel)
const mockReleaseDevice = vi.mocked(releaseDevice)
const mockLoadSyncStatus = vi.mocked(loadSyncStatus)
const mockRunSyncCycle = vi.mocked(runSyncCycle)
const mockConnectSync = vi.mocked(connectSync)
const mockRequestAuthCode = vi.mocked(requestAuthCode)
const mockExchangeCode = vi.mocked(exchangeCode)
const mockCheckLicenseForSync = vi.mocked(checkLicenseForSync)

/** Emulates what the real engine does inside a cycle: its OWN IndexedDB writes go through the db
 *  handle it was given, which runSyncCycle suppresses itself (withSyncWritesSuppressed(fn, db)); a
 *  genuine user write through another handle can land mid-cycle too. Records how many markDirty
 *  calls had been delivered at that point. */
function cycleWithOwnAndUserWrite(
  seen: { during: number }, readCalls: () => number,
): (db: unknown) => Promise<{ status: 'synced'; vaultConflict: false; localChanged: false }> {
  return async (db: unknown) => withSyncWritesSuppressed(async () => {
    notifySyncDirty(db as object) // the cycle's own write
    notifySyncDirty({}) // a user write through another handle, mid-cycle
    seen.during = readCalls()
    return { status: 'synced' as const, vaultConflict: false as const, localChanged: false as const }
  }, db as object)
}

describe('SyncPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadSyncStatus.mockResolvedValue({ connected: false, headRevisions: {} })
    // Default: license (when unlocked) is allowed to sync. Individual tests in
    // the "stopped" describe block below override this per-case.
    mockCheckLicenseForSync.mockResolvedValue({ allowed: true })
  })

  it('shows the locked view (explanation, disabled supporter link) when not unlocked', async () => {
    mockLoadLicense.mockResolvedValue(null)
    render(<SyncPanel />)
    await screen.findByTestId('sync-locked')
    expect(screen.getByTestId('sync-become-supporter')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByTestId('sync-start-button')).toBeInTheDocument()
  })

  it('opening the dialog from the locked view shows a disabled unlock button until a key is typed', async () => {
    mockLoadLicense.mockResolvedValue(null)
    render(<SyncPanel />)
    await screen.findByTestId('sync-locked')
    fireEvent.click(screen.getByTestId('sync-start-button'))
    await screen.findByTestId('sync-connect-dialog')
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
    fireEvent.click(screen.getByTestId('sync-start-button'))
    await screen.findByTestId('sync-connect-dialog')
    fireEvent.change(screen.getByTestId('sync-key-input'), { target: { value: 'abc' } })
    expect(screen.getByTestId('sync-key-submit')).not.toBeDisabled()
  })

  it('strips internal whitespace from the pasted key before activating', async () => {
    mockLoadLicense.mockResolvedValue(null)
    mockActivate.mockResolvedValue({ status: 'invalid-key' })
    render(<SyncPanel />)
    await screen.findByTestId('sync-locked')
    fireEvent.click(screen.getByTestId('sync-start-button'))
    await screen.findByTestId('sync-connect-dialog')
    fireEvent.change(screen.getByTestId('sync-key-input'), { target: { value: 'ab \n cd\t ef' } })
    fireEvent.click(screen.getByTestId('sync-key-submit'))
    await waitFor(() => expect(mockActivate).toHaveBeenCalledWith(expect.anything(), 'abcdef'))
  })

  it('shows the invalid-key error message and stays locked', async () => {
    mockLoadLicense.mockResolvedValue(null)
    mockActivate.mockResolvedValue({ status: 'invalid-key' })
    render(<SyncPanel />)
    await screen.findByTestId('sync-locked')
    fireEvent.click(screen.getByTestId('sync-start-button'))
    await screen.findByTestId('sync-connect-dialog')
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
    fireEvent.click(screen.getByTestId('sync-start-button'))
    await screen.findByTestId('sync-connect-dialog')
    fireEvent.change(screen.getByTestId('sync-key-input'), { target: { value: 'some-key' } })
    fireEvent.click(screen.getByTestId('sync-key-submit'))
    await waitFor(() => expect(screen.getByTestId('sync-key-error')).toHaveTextContent(/browser/i))
  })

  it('shows the cap-exceeded error message with a contact link', async () => {
    mockLoadLicense.mockResolvedValue(null)
    mockActivate.mockResolvedValue({ status: 'cap-exceeded' })
    render(<SyncPanel />)
    await screen.findByTestId('sync-locked')
    fireEvent.click(screen.getByTestId('sync-start-button'))
    await screen.findByTestId('sync-connect-dialog')
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
    fireEvent.click(screen.getByTestId('sync-start-button'))
    await screen.findByTestId('sync-connect-dialog')
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
    fireEvent.click(screen.getByTestId('sync-start-button'))
    await screen.findByTestId('sync-connect-dialog')
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
    mockCheckLicenseForSync.mockResolvedValue({ allowed: true })
  })

  // Safety net: individual withSyncWritesSuppressed tests below also clean up their own
  // setSyncMarkDirty registration inline, but this guarantees no leakage into later tests in
  // this file even if one of them fails before reaching its own cleanup line.
  afterEach(() => { setSyncMarkDirty(null) })

  it('clicking the start button opens the guided setup dialog', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: false, headRevisions: {} })
    render(<SyncPanel />)
    await screen.findByTestId('sync-start-button')
    fireEvent.click(screen.getByTestId('sync-start-button'))
    await screen.findByTestId('sync-connect-dialog')
  })

  it('shows the connect explanation and button when unlocked but not connected', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: false, headRevisions: {} })
    render(<SyncPanel />)
    await screen.findByTestId('sync-start-button')
    fireEvent.click(screen.getByTestId('sync-start-button'))
    await screen.findByTestId('sync-connect-button')
  })

  it('stays on the connect flow (not the locked paywall) if the status read fails after an already-unlocked license read', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockLoadSyncStatus.mockRejectedValue(new Error('indexedDB transaction error'))
    render(<SyncPanel />)
    await screen.findByTestId('sync-start-button')
    fireEvent.click(screen.getByTestId('sync-start-button'))
    await screen.findByTestId('sync-connect-button')
    expect(screen.queryByTestId('sync-locked')).not.toBeInTheDocument()
    consoleErrorSpy.mockRestore()
  })

  it('connects: requests a code, exchanges it, calls connectSync, and finishes on the guided-setup done screen', async () => {
    mockRequestAuthCode.mockResolvedValue('auth-code')
    mockExchangeCode.mockResolvedValue({ accessToken: 'at', expiresAt: Date.now() + 100000, scope: 'drive.file' })
    mockConnectSync.mockResolvedValue({ status: 'synced', vaultConflict: false, localChanged: false })
    // First call = initial mount (disconnected). Second call = applyResult's re-read after
    // connectSync resolves 'synced', to pick up the fresh connectedEmail/lastSyncAt.
    mockLoadSyncStatus
      .mockResolvedValueOnce({ connected: false, headRevisions: {} })
      .mockResolvedValueOnce({ connected: true, headRevisions: {}, connectedEmail: 'user@example.com', lastSyncAt: Date.now() })
    render(<SyncPanel />)
    await screen.findByTestId('sync-start-button')
    fireEvent.click(screen.getByTestId('sync-start-button'))
    await screen.findByTestId('sync-connect-button')
    fireEvent.click(screen.getByTestId('sync-connect-button'))
    // First-time setup lands on the dialog's 'done' screen, not directly on the
    // inline connected view — the guided flow's whole point is to say "you're
    // set up, now do your other devices too" before handing back to the drawer.
    await screen.findByTestId('sync-setup-done')
    expect(mockRequestAuthCode).toHaveBeenCalledTimes(1)
    expect(mockExchangeCode).toHaveBeenCalledWith('auth-code')
    expect(mockConnectSync).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('sync-now-button')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('sync-setup-done-close'))
    // The status bar itself IS the "connected" view now -- its idle/synced
    // state carries the sync-now-button testid, and the Google-Drive info row
    // shows which account it's connected as.
    await screen.findByTestId('sync-now-button')
    expect(screen.getByTestId('sync-row-google-drive').textContent).toContain('user@example.com')
    expect(screen.queryByTestId('sync-connect-dialog')).not.toBeInTheDocument()

    // A later routine "Sync now" click must not reopen the dialog or the done
    // screen — it's just the existing inline sync-now flow, untouched.
    mockRunSyncCycle.mockResolvedValue({ status: 'synced', vaultConflict: false, localChanged: false })
    // The two mockResolvedValueOnce values queued above (mount + post-connect)
    // are both consumed by now; applyResult's re-read after this sync-now call
    // needs its own resolved value, or the mock has nothing left to return.
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, connectedEmail: 'user@example.com', lastSyncAt: Date.now() })
    fireEvent.click(screen.getByTestId('sync-now-button'))
    await waitFor(() => expect(mockRunSyncCycle).toHaveBeenCalledTimes(1))
    await screen.findByTestId('sync-now-button')
    expect(screen.queryByTestId('sync-connect-dialog')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sync-setup-done')).not.toBeInTheDocument()
  })

  // connectSync's own first cycle now goes through the same runSyncCycle that emits
  // notifySyncCycleFinished() -- previously it never did (only sync-controller.ts's flushNow()
  // emitted it). A finished event arriving while the guided dialog is still on its 'connecting'
  // step must not flash it away before handleConnect's own applyResult runs.
  it('a stray sync-cycle-finished event during the guided connect flow does not disturb the connecting step', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: false, headRevisions: {} })
    mockRequestAuthCode.mockResolvedValue('auth-code')
    mockExchangeCode.mockResolvedValue({ accessToken: 'at', expiresAt: Date.now() + 100000, scope: 'drive.file' })
    let resolveConnectSync: (value: { status: 'synced'; vaultConflict: false, localChanged: false }) => void = () => {}
    mockConnectSync.mockImplementation(() => new Promise((resolve) => { resolveConnectSync = resolve }))
    render(<SyncPanel />)
    await screen.findByTestId('sync-start-button')
    fireEvent.click(screen.getByTestId('sync-start-button'))
    await screen.findByTestId('sync-connect-button')
    fireEvent.click(screen.getByTestId('sync-connect-button'))
    await screen.findByTestId('sync-connecting')

    act(() => { notifySyncCycleFinished() })
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.getByTestId('sync-connecting')).toBeInTheDocument()

    mockLoadSyncStatus.mockResolvedValueOnce({ connected: true, headRevisions: {}, connectedEmail: 'user@example.com', lastSyncAt: Date.now() })
    resolveConnectSync({ status: 'synced', vaultConflict: false, localChanged: false })
    await screen.findByTestId('sync-setup-done')
  })

  it('shows connectFailed and the button again if requestAuthCode rejects (popup closed/cancelled)', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: false, headRevisions: {} })
    mockRequestAuthCode.mockRejectedValue(new Error('popup closed'))
    render(<SyncPanel />)
    await screen.findByTestId('sync-start-button')
    fireEvent.click(screen.getByTestId('sync-start-button'))
    await screen.findByTestId('sync-connect-button')
    fireEvent.click(screen.getByTestId('sync-connect-button'))
    await screen.findByTestId('sync-connect-error')
    expect(screen.getByTestId('sync-connect-button')).toBeInTheDocument()
  })

  it('shows the idle status bar (synced, relative last-synced time, refresh icon) and a working click-to-sync', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, connectedEmail: 'user@example.com', lastSyncAt: Date.now() - 5 * 60_000 })
    mockRunSyncCycle.mockResolvedValue({ status: 'synced', vaultConflict: false, localChanged: false })
    render(<SyncPanel />)
    const bar = await screen.findByTestId('sync-now-button')
    expect(bar.textContent).toMatch(/5/) // the relative-time meta ("5 min ago" / "5分前")
    // Screen-reader name is always "Sync now", regardless of the visible label text.
    expect(bar).toHaveAttribute('aria-label', 'Sync now')
    fireEvent.click(bar)
    await waitFor(() => expect(mockRunSyncCycle).toHaveBeenCalledTimes(1))
  })

  it('the busy status bar is disabled (not clickable) while syncing, then returns to the idle bar', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, connectedEmail: 'user@example.com', lastSyncAt: Date.now() })
    let resolveRunSyncCycle: (value: { status: 'synced'; vaultConflict: false, localChanged: false }) => void = () => {}
    mockRunSyncCycle.mockImplementation(() => new Promise((resolve) => { resolveRunSyncCycle = resolve }))
    render(<SyncPanel />)
    await screen.findByTestId('sync-now-button')
    fireEvent.click(screen.getByTestId('sync-now-button'))
    const busyBar = await screen.findByTestId('sync-in-progress')
    expect(busyBar).toBeDisabled()
    expect(busyBar).toHaveAttribute('aria-busy', 'true')

    fireEvent.click(busyBar) // no-op: still disabled
    expect(mockRunSyncCycle).toHaveBeenCalledTimes(1)

    resolveRunSyncCycle({ status: 'synced', vaultConflict: false, localChanged: false })
    await screen.findByTestId('sync-now-button')
  })

  // SyncPanel runs its manual "Sync now" cycle inside withSyncWritesSuppressed. Sync format v2
  // semantics: the cycle's own writes never re-mark sync dirty (the engine suppresses its own db
  // handle), while a genuine user write made during the cycle is held back and delivered exactly
  // once when the cycle ends — never dropped — so it gets pushed by a later cycle.
  it('wraps the manual "Sync now" cycle: its own writes never mark dirty, a user write during it is delivered once afterwards', async () => {
    let markDirtyCalls = 0
    setSyncMarkDirty(() => { markDirtyCalls++ })
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, connectedEmail: 'user@example.com', lastSyncAt: Date.now() })
    const seen = { during: -1 }
    mockRunSyncCycle.mockImplementation(cycleWithOwnAndUserWrite(seen, () => markDirtyCalls))
    render(<SyncPanel />)
    await screen.findByTestId('sync-now-button')

    fireEvent.click(screen.getByTestId('sync-now-button'))
    await waitFor(() => expect(mockRunSyncCycle).toHaveBeenCalledTimes(1))
    await screen.findByTestId('sync-now-button')

    expect(seen.during).toBe(0) // nothing delivered mid-cycle
    expect(markDirtyCalls).toBe(1) // the user write, delivered once after the cycle (own write never)

    notifySyncDirty() // suppression must not leak past the cycle's end
    expect(markDirtyCalls).toBe(2)

    setSyncMarkDirty(null)
  })

  it('wraps handleConnect’s connectSync call the same way (own writes suppressed, user write delivered once after)', async () => {
    let markDirtyCalls = 0
    setSyncMarkDirty(() => { markDirtyCalls++ })
    mockLoadSyncStatus.mockResolvedValue({ connected: false, headRevisions: {} })
    mockRequestAuthCode.mockResolvedValue('auth-code')
    mockExchangeCode.mockResolvedValue({ accessToken: 'at', expiresAt: Date.now() + 100000, scope: 'drive.file' })
    const seen = { during: -1 }
    mockConnectSync.mockImplementation(cycleWithOwnAndUserWrite(seen, () => markDirtyCalls))
    render(<SyncPanel />)
    await screen.findByTestId('sync-start-button')
    fireEvent.click(screen.getByTestId('sync-start-button'))
    await screen.findByTestId('sync-connect-button')
    fireEvent.click(screen.getByTestId('sync-connect-button'))
    await screen.findByTestId('sync-setup-done')

    expect(seen.during).toBe(0)
    expect(markDirtyCalls).toBe(1)

    notifySyncDirty()
    expect(markDirtyCalls).toBe(2)

    setSyncMarkDirty(null)
  })

  it('shows the device count once fetchDeviceCount resolves', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, connectedEmail: 'user@example.com', lastSyncAt: Date.now() })
    mockFetchDeviceCount.mockResolvedValue({ count: 2, max: 5, devices: [] })
    render(<SyncPanel />)
    await screen.findByTestId('sync-now-button')
    await waitFor(() => expect(screen.getByTestId('sync-device-count').textContent).toContain('2'))
    expect(screen.getByTestId('sync-device-count').textContent).toContain('5')
  })

  it('does not show a device count line if fetchDeviceCount fails (returns null)', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, connectedEmail: 'user@example.com', lastSyncAt: Date.now() })
    mockFetchDeviceCount.mockResolvedValue(null)
    render(<SyncPanel />)
    await screen.findByTestId('sync-now-button')
    expect(screen.queryByTestId('sync-device-count')).not.toBeInTheDocument()
  })

  describe('self-heal (registerDeviceLabel)', () => {
    it('this device missing from its own list: registers it, then re-fetches the device list', async () => {
      mockFetchDeviceCount
        .mockResolvedValueOnce({ count: 1, max: 5, devices: [{ id: 'other-device', label: 'Safari · iOS', at: 200 }] })
        .mockResolvedValueOnce({
          count: 2, max: 5,
          devices: [{ id: 'other-device', label: 'Safari · iOS', at: 200 }, { id: 'd1', label: 'Chrome · Windows', at: 300 }],
        })
      render(<SyncPanel />)
      await screen.findByTestId('sync-now-button')
      await waitFor(() => expect(mockRegisterDeviceLabel).toHaveBeenCalledWith('k1', 'd1'))
      await waitFor(() => expect(mockFetchDeviceCount).toHaveBeenCalledTimes(2))
      await waitFor(() => expect(screen.getByTestId('sync-device-count').textContent).toContain('2'))
    })

    it('this device present with a real label: does not call registerDeviceLabel, no refetch', async () => {
      mockFetchDeviceCount.mockResolvedValue({ count: 1, max: 5, devices: [{ id: 'd1', label: 'Chrome · Windows', at: 100 }] })
      render(<SyncPanel />)
      await screen.findByTestId('sync-device-count')
      await waitFor(() => expect(mockFetchDeviceCount).toHaveBeenCalledTimes(1))
      expect(mockRegisterDeviceLabel).not.toHaveBeenCalled()
    })

    it('this device present with an empty (legacy) label: calls registerDeviceLabel, then re-fetches', async () => {
      mockFetchDeviceCount
        .mockResolvedValueOnce({ count: 1, max: 5, devices: [{ id: 'd1', label: '', at: 0 }] })
        .mockResolvedValueOnce({ count: 1, max: 5, devices: [{ id: 'd1', label: 'Chrome · Windows', at: 999 }] })
      render(<SyncPanel />)
      await screen.findByTestId('sync-now-button')
      await waitFor(() => expect(mockRegisterDeviceLabel).toHaveBeenCalledWith('k1', 'd1'))
      await waitFor(() => expect(mockFetchDeviceCount).toHaveBeenCalledTimes(2))
    })
  })

  describe('device list (toggle + remove)', () => {
    beforeEach(() => {
      mockLoadLicense.mockResolvedValue({ kid: 'k1', deviceId: 'me-device', scope: ['sync'], validatedAt: 1 })
      mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, connectedEmail: 'user@example.com', lastSyncAt: Date.now() })
    })

    it('keeps the list hidden until the devices row is clicked, then shows it (whole row is the toggle)', async () => {
      mockFetchDeviceCount.mockResolvedValue({
        count: 2, max: 5,
        devices: [{ id: 'me-device', label: 'Chrome · Windows', at: 100 }, { id: 'other-device', label: 'Safari · iOS', at: 200 }],
      })
      render(<SyncPanel />)
      await screen.findByTestId('sync-device-count')
      expect(screen.queryByTestId('sync-device-list')).not.toBeInTheDocument()

      fireEvent.click(screen.getByTestId('sync-device-count'))
      await screen.findByTestId('sync-device-list')
      expect(screen.getByTestId('sync-device-count')).toHaveAttribute('aria-expanded', 'true')
    })

    it('marks the current device with thisDevice text and no remove button', async () => {
      mockFetchDeviceCount.mockResolvedValue({
        count: 2, max: 5,
        devices: [{ id: 'me-device', label: 'Chrome · Windows', at: 100 }, { id: 'other-device', label: 'Safari · iOS', at: 200 }],
      })
      render(<SyncPanel />)
      fireEvent.click(await screen.findByTestId('sync-device-count'))
      const meRow = await screen.findByTestId('sync-device-row-me-device')
      expect(meRow.textContent).toContain('Chrome · Windows')
      expect(screen.queryByTestId('sync-device-remove-me-device')).not.toBeInTheDocument()
    })

    it('falls back to the unknownDevice label when a device has an empty label', async () => {
      mockFetchDeviceCount.mockResolvedValue({
        count: 2, max: 5,
        devices: [{ id: 'me-device', label: 'Chrome · Windows', at: 100 }, { id: 'other-device', label: '', at: 200 }],
      })
      render(<SyncPanel />)
      fireEvent.click(await screen.findByTestId('sync-device-count'))
      const row = await screen.findByTestId('sync-device-row-other-device')
      expect(row.textContent).toMatch(/unknown|不明/i)
    })

    it('requires two clicks to remove: first arms confirm, second calls releaseDevice with (kid, myDeviceId, targetId) and removes the row', async () => {
      mockFetchDeviceCount.mockResolvedValue({
        count: 2, max: 5,
        devices: [{ id: 'me-device', label: 'Chrome · Windows', at: 100 }, { id: 'other-device', label: 'Safari · iOS', at: 200 }],
      })
      mockReleaseDevice.mockResolvedValue(true)
      render(<SyncPanel />)
      fireEvent.click(await screen.findByTestId('sync-device-count'))
      const removeBtn = await screen.findByTestId('sync-device-remove-other-device')

      fireEvent.click(removeBtn)
      expect(mockReleaseDevice).not.toHaveBeenCalled()

      fireEvent.click(removeBtn)
      await waitFor(() => expect(mockReleaseDevice).toHaveBeenCalledWith('k1', 'me-device', 'other-device'))
      await waitFor(() => expect(screen.queryByTestId('sync-device-row-other-device')).not.toBeInTheDocument())
      expect(screen.getByTestId('sync-device-count').textContent).toContain('1')
    })

    it('keeps the row in place if releaseDevice fails', async () => {
      mockFetchDeviceCount.mockResolvedValue({
        count: 2, max: 5,
        devices: [{ id: 'me-device', label: 'Chrome · Windows', at: 100 }, { id: 'other-device', label: 'Safari · iOS', at: 200 }],
      })
      mockReleaseDevice.mockResolvedValue(false)
      render(<SyncPanel />)
      fireEvent.click(await screen.findByTestId('sync-device-count'))
      const removeBtn = await screen.findByTestId('sync-device-remove-other-device')

      fireEvent.click(removeBtn)
      fireEvent.click(removeBtn)
      await waitFor(() => expect(mockReleaseDevice).toHaveBeenCalledTimes(1))
      expect(await screen.findByTestId('sync-device-row-other-device')).toBeInTheDocument()
      expect(screen.getByTestId('sync-device-count').textContent).toContain('2')
    })

    it('reverts the confirm state back to the normal remove label after 3s if not clicked again', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      try {
        mockFetchDeviceCount.mockResolvedValue({
          count: 2, max: 5,
          devices: [{ id: 'me-device', label: 'Chrome · Windows', at: 100 }, { id: 'other-device', label: 'Safari · iOS', at: 200 }],
        })
        render(<SyncPanel />)
        fireEvent.click(await screen.findByTestId('sync-device-count'))
        const removeBtn = await screen.findByTestId('sync-device-remove-other-device')

        fireEvent.click(removeBtn)
        await waitFor(() => expect(screen.getByTestId('sync-device-remove-other-device').textContent).toBe('Click again to remove'))

        await act(async () => { await vi.advanceTimersByTimeAsync(3100) })
        expect(screen.getByTestId('sync-device-remove-other-device').textContent).toBe('Remove')
        expect(mockReleaseDevice).not.toHaveBeenCalled()
        expect(screen.getByTestId('sync-device-row-other-device')).toBeInTheDocument()
      } finally {
        vi.useRealTimers()
      }
    })
  })

  it('shows the SyncMassDeleteConfirmDialog when a manual sync returns needs-confirmation', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, connectedEmail: 'user@example.com', lastSyncAt: Date.now() })
    mockRunSyncCycle.mockResolvedValue({ status: 'needs-confirmation', vaultConflict: false, localChanged: false, deletedCount: 12 })
    render(<SyncPanel />)
    await screen.findByTestId('sync-now-button')
    fireEvent.click(screen.getByTestId('sync-now-button'))
    await screen.findByTestId('sync-mass-delete-dialog')
    expect(screen.getByTestId('sync-mass-delete-dialog').textContent).toContain('12')
  })

  it('CONTINUE on the mass-delete dialog re-runs the cycle with bypassMassDeleteGuard', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, connectedEmail: 'user@example.com', lastSyncAt: Date.now() })
    mockRunSyncCycle
      .mockResolvedValueOnce({ status: 'needs-confirmation', vaultConflict: false, localChanged: false, deletedCount: 12 })
      .mockResolvedValueOnce({ status: 'synced', vaultConflict: false, localChanged: false })
    render(<SyncPanel />)
    await screen.findByTestId('sync-now-button')
    fireEvent.click(screen.getByTestId('sync-now-button'))
    await screen.findByTestId('sync-mass-delete-dialog')
    fireEvent.click(screen.getByTestId('sync-mass-delete-continue'))
    await waitFor(() => expect(mockRunSyncCycle).toHaveBeenCalledTimes(2))
    expect(mockRunSyncCycle).toHaveBeenLastCalledWith(expect.anything(), { bypassMassDeleteGuard: true })
  })

  it('wraps the mass-delete CONTINUE retry cycle the same way (own writes suppressed, user write delivered once after)', async () => {
    let markDirtyCalls = 0
    setSyncMarkDirty(() => { markDirtyCalls++ })
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, connectedEmail: 'user@example.com', lastSyncAt: Date.now() })
    const seen = { during: -1 }
    mockRunSyncCycle
      .mockResolvedValueOnce({ status: 'needs-confirmation', vaultConflict: false, localChanged: false, deletedCount: 12 })
      .mockImplementationOnce(cycleWithOwnAndUserWrite(seen, () => markDirtyCalls))
    render(<SyncPanel />)
    await screen.findByTestId('sync-now-button')
    fireEvent.click(screen.getByTestId('sync-now-button'))
    await screen.findByTestId('sync-mass-delete-dialog')

    fireEvent.click(screen.getByTestId('sync-mass-delete-continue'))
    await waitFor(() => expect(mockRunSyncCycle).toHaveBeenCalledTimes(2))
    await screen.findByTestId('sync-now-button')

    expect(seen.during).toBe(0)
    expect(markDirtyCalls).toBe(1)

    notifySyncDirty()
    expect(markDirtyCalls).toBe(2)

    setSyncMarkDirty(null)
  })

  // Item 4: SyncPanel is mounted independently of whatever triggered a background sync cycle
  // (auto debounce, tab-hide, the online listener) — it must refresh its own displayed phase off
  // that event instead of only ever reading sync-status on its own mount.
  it('re-reads sync status when a background sync cycle finishes elsewhere, while idle', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, connectedEmail: 'user@example.com', lastSyncAt: Date.now() })
    render(<SyncPanel />)
    await screen.findByTestId('sync-now-button')
    const callsBefore = mockLoadSyncStatus.mock.calls.length

    act(() => { notifySyncCycleFinished() })
    await waitFor(() => expect(mockLoadSyncStatus.mock.calls.length).toBeGreaterThan(callsBefore))
    expect(screen.getByTestId('sync-now-button')).toBeInTheDocument()
  })

  // Item: a background cycle (e.g. sync-controller.ts's debounce/tab-hide/online-triggered
  // flushNow, or a manual cycle from another open instance of this panel) is otherwise invisible
  // to a mounted, idle SyncPanel -- it just keeps showing the previous "connected" result while
  // the cycle runs. engine.ts's runSyncCycle now emits notifySyncCycleStarted()/Finished()
  // around every cycle, and SyncPanel must show 'syncing' for the duration.
  it('shows sync-in-progress when a background cycle starts elsewhere while idle, and returns to the idle bar on finish', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, connectedEmail: 'user@example.com', lastSyncAt: Date.now() })
    render(<SyncPanel />)
    await screen.findByTestId('sync-now-button')

    act(() => { notifySyncCycleStarted() })
    try {
      // Only surfaced once the cycle has run for ~1s (short polls must not blink the panel).
      await screen.findByTestId('sync-in-progress', {}, { timeout: 3000 })
      expect(screen.queryByTestId('sync-now-button')).not.toBeInTheDocument()
    } finally {
      act(() => { notifySyncCycleFinished() })
    }
    await screen.findByTestId('sync-now-button')
  })

  it('does not blink to sync-in-progress for a background cycle that finishes quickly', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, connectedEmail: 'user@example.com', lastSyncAt: Date.now() })
    render(<SyncPanel />)
    await screen.findByTestId('sync-now-button')

    act(() => { notifySyncCycleStarted() })
    act(() => { notifySyncCycleFinished() })
    await new Promise((resolve) => setTimeout(resolve, 1300))
    expect(screen.queryByTestId('sync-in-progress')).not.toBeInTheDocument()
    expect(screen.getByTestId('sync-now-button')).toBeInTheDocument()
  })

  it('shows sync-in-progress on mount when a background cycle is already running before the panel mounts', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, connectedEmail: 'user@example.com', lastSyncAt: Date.now() })
    notifySyncCycleStarted() // simulates a cycle that began before this panel instance existed
    try {
      render(<SyncPanel />)
      await screen.findByTestId('sync-in-progress')
    } finally {
      notifySyncCycleFinished()
    }
  })

  it('does not show sync-in-progress on mount when disconnected, even if a cycle happens to be in flight', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: false, headRevisions: {} })
    notifySyncCycleStarted()
    try {
      render(<SyncPanel />)
      await screen.findByTestId('sync-start-button')
      expect(screen.queryByTestId('sync-in-progress')).not.toBeInTheDocument()
    } finally {
      notifySyncCycleFinished()
    }
  })

  it('a background cycle starting does not disturb the mass-delete confirmation dialog', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, connectedEmail: 'user@example.com', lastSyncAt: Date.now() })
    mockRunSyncCycle.mockResolvedValue({ status: 'needs-confirmation', vaultConflict: false, localChanged: false, deletedCount: 12 })
    render(<SyncPanel />)
    await screen.findByTestId('sync-now-button')
    fireEvent.click(screen.getByTestId('sync-now-button'))
    await screen.findByTestId('sync-mass-delete-dialog')

    act(() => { notifySyncCycleStarted() })
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.getByTestId('sync-mass-delete-dialog')).toBeInTheDocument()
    notifySyncCycleFinished()
  })

  it('ignores a background cycle-finished event while its own manual sync is in flight', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, connectedEmail: 'user@example.com', lastSyncAt: Date.now() })
    let resolveRunSyncCycle: (value: { status: 'synced'; vaultConflict: false, localChanged: false }) => void = () => {}
    mockRunSyncCycle.mockImplementation(() => new Promise((resolve) => { resolveRunSyncCycle = resolve }))
    render(<SyncPanel />)
    await screen.findByTestId('sync-now-button')
    fireEvent.click(screen.getByTestId('sync-now-button'))
    await screen.findByTestId('sync-in-progress')

    act(() => { notifySyncCycleFinished() })
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.getByTestId('sync-in-progress')).toBeInTheDocument()

    resolveRunSyncCycle({ status: 'synced', vaultConflict: false, localChanged: false })
    await screen.findByTestId('sync-now-button')
  })

  it('ignores a background cycle-finished event while showing the mass-delete confirmation dialog', async () => {
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, connectedEmail: 'user@example.com', lastSyncAt: Date.now() })
    mockRunSyncCycle.mockResolvedValue({ status: 'needs-confirmation', vaultConflict: false, localChanged: false, deletedCount: 12 })
    render(<SyncPanel />)
    await screen.findByTestId('sync-now-button')
    fireEvent.click(screen.getByTestId('sync-now-button'))
    await screen.findByTestId('sync-mass-delete-dialog')

    act(() => { notifySyncCycleFinished() })
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.getByTestId('sync-mass-delete-dialog')).toBeInTheDocument()
  })

  it('shows the reconnect copy on the issue bar for an auth error, and clicking it reconnects', async () => {
    mockLoadSyncStatus.mockResolvedValue({
      connected: true, headRevisions: {}, connectedEmail: 'user@example.com',
      lastIssue: { kind: 'error', errorKind: 'auth' },
    })
    mockRequestAuthCode.mockResolvedValue('auth-code')
    mockExchangeCode.mockResolvedValue({ accessToken: 'at', expiresAt: Date.now() + 100000, scope: 'drive.file' })
    mockConnectSync.mockResolvedValue({ status: 'synced', vaultConflict: false, localChanged: false })
    render(<SyncPanel />)
    const bar = await screen.findByTestId('sync-issue')
    expect(bar.textContent).toMatch(/reconnect|再接続|接続が切れました/i)
    // Same fixed screen-reader name as every other bar state.
    expect(bar).toHaveAttribute('aria-label', 'Sync now')

    fireEvent.click(bar)
    await waitFor(() => expect(mockRequestAuthCode).toHaveBeenCalledTimes(1))
  })

  it('shows the neutral offline status for a network issue, with no explanation note, and clicking it retries', async () => {
    mockLoadSyncStatus.mockResolvedValue({
      connected: true, headRevisions: {}, connectedEmail: 'user@example.com',
      lastIssue: { kind: 'error', errorKind: 'network' },
    })
    mockRunSyncCycle.mockResolvedValue({ status: 'synced', vaultConflict: false, localChanged: false })
    render(<SyncPanel />)
    const bar = await screen.findByTestId('sync-issue')
    expect(bar.textContent).toMatch(/offline|オフライン/i)
    expect(screen.queryByTestId('sync-issue-explain')).not.toBeInTheDocument()

    fireEvent.click(bar)
    await waitFor(() => expect(mockRunSyncCycle).toHaveBeenCalledTimes(1))
  })

  it('shows the failed status, the long explanation, and the diagnostic detail line for a non-auth/network issue (e.g. storage-full), and clicking it retries', async () => {
    mockLoadSyncStatus.mockResolvedValue({
      connected: true, headRevisions: {}, connectedEmail: 'user@example.com',
      lastIssue: { kind: 'error', errorKind: 'storage-full', detail: 'upload bookmarks-3.json.gz: quota exceeded' },
    })
    mockRunSyncCycle.mockResolvedValue({ status: 'synced', vaultConflict: false, localChanged: false })
    render(<SyncPanel />)
    const bar = await screen.findByTestId('sync-issue')
    expect(bar.textContent).toMatch(/couldn.?t sync|同期できませんでした/i)
    expect(screen.getByTestId('sync-issue-explain')).toBeInTheDocument()
    expect(screen.getByTestId('sync-issue-detail').textContent).toContain('quota exceeded')

    fireEvent.click(bar)
    await waitFor(() => expect(mockRunSyncCycle).toHaveBeenCalledTimes(1))
  })

  it('keeps the sync log hidden until registerHeadingTap fires 5 times, then toggles it off again on the next 5', async () => {
    const trace = { startedAt: Date.now(), totalMs: 0.3, steps: [{ name: 'list', ms: 0.3, ok: true }] }
    mockLoadSyncStatus.mockResolvedValue({
      connected: true, headRevisions: {}, connectedEmail: 'user@example.com', lastSyncAt: Date.now(),
      lastCycleTrace: trace,
    })
    const ref = createRef<SyncPanelHandle>()
    render(<SyncPanel ref={ref} />)
    await screen.findByTestId('sync-now-button')
    expect(screen.queryByTestId('sync-diagnostics-trace')).not.toBeInTheDocument()

    act(() => {
      for (let i = 0; i < 4; i++) ref.current?.registerHeadingTap()
    })
    expect(screen.queryByTestId('sync-diagnostics-trace')).not.toBeInTheDocument()

    act(() => { ref.current?.registerHeadingTap() })
    await screen.findByTestId('sync-diagnostics-trace')

    act(() => {
      for (let i = 0; i < 5; i++) ref.current?.registerHeadingTap()
    })
    expect(screen.queryByTestId('sync-diagnostics-trace')).not.toBeInTheDocument()
  })
})

describe('SyncPanel stopped states (license-check gate)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadLicense.mockResolvedValue({ kid: 'k1', deviceId: 'd1', scope: ['sync'], validatedAt: 1 })
    mockLoadSyncStatus.mockResolvedValue({ connected: true, headRevisions: {}, connectedEmail: 'user@example.com', lastSyncAt: Date.now() })
    // Default: mount-time license check passes. Tests that exercise the mount-
    // time gate itself override this before rendering.
    mockCheckLicenseForSync.mockResolvedValue({ allowed: true })
  })

  it('shows the stopped/ended view (message + pricing link), hiding the status bar', async () => {
    mockCheckLicenseForSync.mockResolvedValue({ allowed: false, reason: 'ended' })
    render(<SyncPanel />)
    await screen.findByTestId('sync-stopped-ended')
    expect(screen.getByTestId('sync-pricing-link')).toHaveAttribute('href', '/pricing')
    expect(screen.queryByTestId('sync-now-button')).not.toBeInTheDocument()
  })

  it('shows the stopped/device-removed view with the key-entry form, and a successful submit leaves the stopped view for the normal connected flow', async () => {
    mockCheckLicenseForSync.mockResolvedValue({ allowed: false, reason: 'device-removed' })
    render(<SyncPanel />)
    await screen.findByTestId('sync-stopped-device-removed')
    expect(screen.getByTestId('sync-key-input')).toBeInTheDocument()
    expect(screen.queryByTestId('sync-now-button')).not.toBeInTheDocument()

    mockActivate.mockResolvedValue({ status: 'unlocked', scope: ['sync'], verified: true })
    fireEvent.change(screen.getByTestId('sync-key-input'), { target: { value: 'new-key' } })
    fireEvent.click(screen.getByTestId('sync-key-submit'))

    await screen.findByTestId('sync-now-button')
    expect(screen.queryByTestId('sync-stopped-device-removed')).not.toBeInTheDocument()
  })

  it('shows the stopped/grace-expired view with no Sync now button and no key input', async () => {
    mockCheckLicenseForSync.mockResolvedValue({ allowed: false, reason: 'grace-expired' })
    render(<SyncPanel />)
    await screen.findByTestId('sync-stopped-grace-expired')
    expect(screen.queryByTestId('sync-now-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sync-key-input')).not.toBeInTheDocument()
  })

  it('falls back to the locked view when the license check reports no-license, even though a license record was loaded', async () => {
    mockCheckLicenseForSync.mockResolvedValue({ allowed: false, reason: 'no-license' })
    render(<SyncPanel />)
    await screen.findByTestId('sync-locked')
  })

  it('ignores a background cycle-finished event while showing a stopped phase', async () => {
    mockCheckLicenseForSync.mockResolvedValue({ allowed: false, reason: 'ended' })
    render(<SyncPanel />)
    await screen.findByTestId('sync-stopped-ended')

    act(() => { notifySyncCycleFinished() })
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.getByTestId('sync-stopped-ended')).toBeInTheDocument()
  })

  it('ignores a background cycle-started event while showing a stopped phase', async () => {
    mockCheckLicenseForSync.mockResolvedValue({ allowed: false, reason: 'ended' })
    render(<SyncPanel />)
    await screen.findByTestId('sync-stopped-ended')

    act(() => { notifySyncCycleStarted() })
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.getByTestId('sync-stopped-ended')).toBeInTheDocument()
    expect(screen.queryByTestId('sync-in-progress')).not.toBeInTheDocument()
    notifySyncCycleFinished()
  })

  it('a license-inactive result from Sync now switches to the stopped view, not disconnected', async () => {
    mockRunSyncCycle.mockResolvedValue({ status: 'license-inactive', vaultConflict: false, localChanged: false, licenseReason: 'ended' })
    render(<SyncPanel />)
    await screen.findByTestId('sync-now-button')
    fireEvent.click(screen.getByTestId('sync-now-button'))
    await screen.findByTestId('sync-stopped-ended')
    expect(screen.queryByTestId('sync-start-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sync-now-button')).not.toBeInTheDocument()
  })
})
