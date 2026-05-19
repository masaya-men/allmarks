import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { PipCompanion } from './PipCompanion'
import { broadcastPipOpen, broadcastPipClosed } from '@/lib/board/pip-presence'

let savedHandler: ((msg: { bookmarkId: string }) => void) | null = null
let deletedHandler: ((msg: { bookmarkId: string }) => void) | null = null

vi.mock('@/lib/storage/indexeddb', () => ({
  initDB: vi.fn().mockResolvedValue({
    get: vi.fn().mockImplementation((_store: string, id: string) =>
      Promise.resolve({ id, title: `Title ${id}`, thumbnail: '', favicon: '', url: '' }),
    ),
  }),
}))

vi.mock('@/lib/board/channel', () => ({
  subscribeBookmarkSaved: vi.fn((handler: (msg: { bookmarkId: string }) => void) => {
    savedHandler = handler
    return () => { savedHandler = null }
  }),
  subscribeBookmarkDeleted: vi.fn((handler: (msg: { bookmarkId: string }) => void) => {
    deletedHandler = handler
    return () => { deletedHandler = null }
  }),
}))

vi.mock('@/lib/board/pip-presence', () => ({
  broadcastPipOpen: vi.fn(),
  broadcastPipClosed: vi.fn(),
  subscribePipPresence: vi.fn(() => () => {}),
}))

describe('PipCompanion', () => {
  beforeEach(() => {
    savedHandler = null
    deletedHandler = null
    vi.clearAllMocks()
  })

  it('renders empty state on mount (no initial IDB read of past bookmarks)', () => {
    render(<PipCompanion onClose={() => {}} />)
    expect(screen.getByTestId('pip-empty-state')).toBeTruthy()
  })

  it('switches to stack when a new bookmark-saved event arrives', async () => {
    render(<PipCompanion onClose={() => {}} />)
    expect(screen.getByTestId('pip-empty-state')).toBeTruthy()

    // Simulate the BroadcastChannel callback firing.
    expect(savedHandler).toBeTruthy()
    await act(async () => {
      await savedHandler?.({ bookmarkId: 'b1' })
    })

    await waitFor(() => {
      expect(screen.getByTestId('pip-stack')).toBeTruthy()
    })
  })

  it('broadcasts pip:open on mount and pip:closed on unmount', () => {
    const { unmount } = render(<PipCompanion onClose={() => {}} />)
    expect(broadcastPipOpen).toHaveBeenCalledOnce()
    expect(broadcastPipClosed).not.toHaveBeenCalled()
    unmount()
    expect(broadcastPipClosed).toHaveBeenCalledOnce()
  })

  it('drops the matching card when a bookmark-deleted event arrives', async () => {
    render(<PipCompanion onClose={() => {}} />)
    expect(savedHandler).toBeTruthy()
    expect(deletedHandler).toBeTruthy()
    // Seed two cards into the PiP buffer
    await act(async () => {
      await savedHandler?.({ bookmarkId: 'b1' })
      await savedHandler?.({ bookmarkId: 'b2' })
    })
    await waitFor(() => {
      expect(screen.getByTestId('pip-card-b1')).toBeTruthy()
      expect(screen.getByTestId('pip-card-b2')).toBeTruthy()
    })
    // Fire delete for b1 — b2 should remain
    await act(async () => {
      deletedHandler?.({ bookmarkId: 'b1' })
    })
    await waitFor(() => {
      expect(screen.queryByTestId('pip-card-b1')).toBeNull()
      expect(screen.getByTestId('pip-card-b2')).toBeTruthy()
    })
  })

})
