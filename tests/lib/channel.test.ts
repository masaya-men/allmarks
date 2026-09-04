/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import {
  postBookmarkSaved,
  subscribeBookmarkSaved,
  postBookmarkUpdated,
  subscribeBookmarkUpdated,
  postBookmarkDeleted,
  subscribeBookmarkDeleted,
} from '@/lib/board/channel'

// BroadcastChannel delivery is async and the exact tick it lands on varies
// with event-loop load (it flaked only under a full parallel suite run). For
// "should fire" cases poll with vi.waitFor; for "should NOT fire" cases give
// delivery a generous fixed window, then assert it never came.
const NEGATIVE_WAIT_MS = 50

describe('BroadcastChannel helper', () => {
  it('subscriber receives postBookmarkSaved event', async () => {
    const handler = vi.fn()
    const unsub = subscribeBookmarkSaved(handler)
    postBookmarkSaved({ bookmarkId: 'b1' })
    await vi.waitFor(() => expect(handler).toHaveBeenCalledWith({ bookmarkId: 'b1' }))
    unsub()
  })

  it('unsubscribe stops the handler from firing', async () => {
    const handler = vi.fn()
    const unsub = subscribeBookmarkSaved(handler)
    unsub()
    postBookmarkSaved({ bookmarkId: 'b2' })
    await new Promise((r) => setTimeout(r, NEGATIVE_WAIT_MS))
    expect(handler).not.toHaveBeenCalled()
  })

  it('subscriber receives postBookmarkDeleted event', async () => {
    const handler = vi.fn()
    const unsub = subscribeBookmarkDeleted(handler)
    postBookmarkDeleted({ bookmarkId: 'b3' })
    await vi.waitFor(() => expect(handler).toHaveBeenCalledWith({ bookmarkId: 'b3' }))
    unsub()
  })

  it('subscriber receives postBookmarkUpdated event', async () => {
    const handler = vi.fn()
    const unsub = subscribeBookmarkUpdated(handler)
    postBookmarkUpdated({ bookmarkId: 'b5' })
    await vi.waitFor(() => expect(handler).toHaveBeenCalledWith({ bookmarkId: 'b5' }))
    unsub()
  })

  it('updated subscriber ignores save events (different message type)', async () => {
    const updatedHandler = vi.fn()
    const unsub = subscribeBookmarkUpdated(updatedHandler)
    postBookmarkSaved({ bookmarkId: 'b6' })
    await new Promise((r) => setTimeout(r, NEGATIVE_WAIT_MS))
    expect(updatedHandler).not.toHaveBeenCalled()
    unsub()
  })

  it('deleted subscriber ignores save events (different message type)', async () => {
    const deletedHandler = vi.fn()
    const unsub = subscribeBookmarkDeleted(deletedHandler)
    postBookmarkSaved({ bookmarkId: 'b4' })
    await new Promise((r) => setTimeout(r, NEGATIVE_WAIT_MS))
    expect(deletedHandler).not.toHaveBeenCalled()
    unsub()
  })
})
