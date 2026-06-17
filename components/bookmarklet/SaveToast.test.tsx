import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { SaveToast } from './SaveToast'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams({ url: 'https://x.com/a/status/1', title: 'Hi' }),
}))
const addBookmark = vi.fn(async () => ({ id: 'b1', tags: [] }))
const getAllBookmarks = vi.fn(async () => [] as Array<{ id: string; url: string; isDeleted?: boolean; tags: string[] }>)
vi.mock('@/lib/storage/indexeddb', () => ({
  initDB: vi.fn(async () => ({})),
  addBookmark: (...a: unknown[]) => (addBookmark as (...args: unknown[]) => unknown)(...a),
  getAllBookmarks: (...a: unknown[]) => (getAllBookmarks as (...args: unknown[]) => unknown)(...a),
}))
vi.mock('@/lib/storage/quick-tag-setting', () => ({ loadQuickTagEnabled: vi.fn(async () => false) }))
vi.mock('@/lib/board/pip-presence', () => ({ queryPipPresence: vi.fn(async () => false) }))
vi.mock('@/lib/board/channel', () => ({ postBookmarkSaved: vi.fn(), postBookmarkUpdated: vi.fn() }))
vi.mock('@/lib/utils/url', () => ({ detectUrlType: () => 'tweet' }))

async function flush(ms: number): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}

describe('SaveToast deliberate confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    Object.defineProperty(window, 'close', { value: vi.fn(), writable: true, configurable: true })
    getAllBookmarks.mockResolvedValue([])
    addBookmark.mockResolvedValue({ id: 'b1', tags: [] })
  })

  it('new save → shows Saved then auto-closes (no tags when feature off)', async () => {
    render(<SaveToast />)
    await flush(500) // min-saving + async work
    expect(screen.getByTestId('save-toast').getAttribute('data-state')).toBe('saved')
    expect(screen.getByText('Saved')).toBeTruthy()
    expect(window.close).not.toHaveBeenCalled()
    await flush(1900)
    expect(window.close).toHaveBeenCalled()
  })

  it('duplicate (same non-deleted url) → Already saved, no second addBookmark', async () => {
    getAllBookmarks.mockResolvedValue([{ id: 'old', url: 'https://x.com/a/status/1', isDeleted: false, tags: [] }])
    render(<SaveToast />)
    await flush(500)
    expect(screen.getByTestId('save-toast').getAttribute('data-state')).toBe('duplicate')
    expect(screen.getByText('Already saved')).toBeTruthy()
    expect(addBookmark).not.toHaveBeenCalled()
  })

  it('save failure → Failed then auto-closes', async () => {
    addBookmark.mockRejectedValue(new Error('boom'))
    render(<SaveToast />)
    await flush(500)
    expect(screen.getByTestId('save-toast').getAttribute('data-state')).toBe('error')
    expect(screen.getByText('Failed')).toBeTruthy()
    await flush(2500)
    expect(window.close).toHaveBeenCalled()
  })
})
