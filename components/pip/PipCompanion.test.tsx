import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import { PipCompanion } from './PipCompanion'
import { broadcastPipOpen, broadcastPipClosed } from '@/lib/board/pip-presence'
import { addTagToBookmark } from '@/lib/storage/tags'
import { postBookmarkUpdated } from '@/lib/board/channel'

let savedHandler: ((msg: { bookmarkId: string }) => void) | null = null
let deletedHandler: ((msg: { bookmarkId: string }) => void) | null = null

vi.mock('@/lib/storage/indexeddb', () => ({
  initDB: vi.fn().mockResolvedValue({
    get: vi.fn().mockImplementation((_store: string, id: string) =>
      Promise.resolve({ id, title: `Title ${id}`, thumbnail: '', favicon: '', url: '', tags: [] }),
    ),
  }),
  getAllBookmarks: vi.fn(async () => []),
}))

vi.mock('@/lib/storage/tags', () => ({
  getAllTags: vi.fn(async () => [
    { id: 't1', name: 'design', color: '#fff' },
    { id: 't2', name: 'video', color: '#fff' },
  ]),
  addTagToBookmark: vi.fn(async () => {}),
}))

vi.mock('@/lib/tagger/order-tags-for-save', () => ({
  orderTagsForSave: vi.fn(() => [
    { id: 't1', name: 'design', color: '#fff' },
    { id: 't2', name: 'video', color: '#fff' },
  ]),
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
  postBookmarkUpdated: vi.fn(),
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

  it('tags the active card in place: addTagToBookmark + postBookmarkUpdated fire with the right id', async () => {
    render(<PipCompanion onClose={() => {}} />)
    expect(savedHandler).toBeTruthy()
    // Save one bookmark — it becomes the active (centred) card so the
    // "+" affordance renders on it.
    await act(async () => {
      await savedHandler?.({ bookmarkId: 'b1' })
    })
    await waitFor(() => {
      expect(screen.getByTestId('pip-card-b1')).toBeTruthy()
    })

    // Open the strip via the "+" button, then tap a chip.
    const addBtn = await screen.findByLabelText('Add tag')
    await act(async () => {
      fireEvent.click(addBtn)
    })
    const chip = await screen.findByText('design')
    await act(async () => {
      fireEvent.click(chip)
    })

    await waitFor(() => {
      expect(addTagToBookmark).toHaveBeenCalledWith(expect.anything(), 'b1', 't1')
      expect(postBookmarkUpdated).toHaveBeenCalledWith({ bookmarkId: 'b1' })
    })
  })

  it('re-tapping an already-applied chip is a no-op: addTagToBookmark + postBookmarkUpdated called exactly once', async () => {
    render(<PipCompanion onClose={() => {}} />)
    expect(savedHandler).toBeTruthy()
    // Save one bookmark so the card + "+" affordance appear.
    await act(async () => {
      await savedHandler?.({ bookmarkId: 'b1' })
    })
    await waitFor(() => {
      expect(screen.getByTestId('pip-card-b1')).toBeTruthy()
    })

    // Open the strip.
    const addBtn = await screen.findByLabelText('Add tag')
    await act(async () => {
      fireEvent.click(addBtn)
    })

    // First tap — applies the tag. The chip text may change to "✓ design".
    const chipFirst = await screen.findByText(/design/)
    await act(async () => {
      fireEvent.click(chipFirst)
    })
    await waitFor(() => {
      expect(addTagToBookmark).toHaveBeenCalledTimes(1)
      expect(postBookmarkUpdated).toHaveBeenCalledTimes(1)
    })

    // Second tap on the same chip — should be a no-op.
    // Re-query because the text may have changed to "✓ design".
    const chipSecond = screen.getByText(/design/)
    await act(async () => {
      fireEvent.click(chipSecond)
    })

    // Give any async work a chance to settle, then assert counts are unchanged.
    await waitFor(() => {
      expect(addTagToBookmark).toHaveBeenCalledTimes(1)
      expect(postBookmarkUpdated).toHaveBeenCalledTimes(1)
    })
  })

})
