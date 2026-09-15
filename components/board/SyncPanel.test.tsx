import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SyncPanel } from './SyncPanel'
import { loadLicense } from '@/lib/board/license-store'
import { activateLicenseKey } from '@/lib/board/license-activate'

vi.mock('@/lib/storage/indexeddb', () => ({ initDB: vi.fn().mockResolvedValue({}) }))
vi.mock('@/lib/board/license-store', () => ({ loadLicense: vi.fn() }))
vi.mock('@/lib/board/license-activate', () => ({ activateLicenseKey: vi.fn() }))

const mockLoadLicense = vi.mocked(loadLicense)
const mockActivate = vi.mocked(activateLicenseKey)

describe('SyncPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})
