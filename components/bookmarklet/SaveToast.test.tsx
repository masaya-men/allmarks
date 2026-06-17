import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act, within, fireEvent } from '@testing-library/react'
import { SaveToast } from './SaveToast'

let mockParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockParams,
}))

vi.mock('@/lib/storage/indexeddb', () => ({
  initDB: vi.fn().mockResolvedValue({}),
  addBookmark: vi.fn().mockResolvedValue({ id: 'bm-test-1', tags: [] }),
  getAllBookmarks: vi.fn(async () => []),
}))

vi.mock('@/lib/storage/tags', () => ({
  getAllTags: vi.fn(async () => [{ id: 't1', name: 'design', color: '#fff', order: 0 }]),
  addTagToBookmark: vi.fn(async () => {}),
  addTag: vi.fn(async () => ({ id: 't2', name: 'new', color: '#28F100', order: 1 })),
}))

vi.mock('@/lib/tagger/order-tags-for-save', () => ({
  orderTagsForSave: vi.fn(() => [{ id: 't1', name: 'design', color: '#fff' }]),
}))

vi.mock('@/lib/board/channel', () => ({
  postBookmarkSaved: vi.fn(),
  postBookmarkUpdated: vi.fn(),
}))

vi.mock('@/lib/storage/quick-tag-setting', () => ({
  loadQuickTagEnabled: vi.fn(async () => true),
}))

let mockPipActive = false
vi.mock('@/lib/board/pip-presence', () => ({
  queryPipPresence: vi.fn(() => Promise.resolve(mockPipActive)),
}))

vi.mock('@/lib/utils/url', () => ({ detectUrlType: () => 'tweet' }))

import { loadQuickTagEnabled } from '@/lib/storage/quick-tag-setting'
import { queryPipPresence } from '@/lib/board/pip-presence'

describe('SaveToast', () => {
  beforeEach(() => {
    mockParams = new URLSearchParams()
    mockPipActive = false
    Object.defineProperty(window, 'resizeTo', { value: vi.fn(), writable: true, configurable: true })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('shows a hint when opened with no url param', () => {
    render(<SaveToast />)
    const stage = screen.getByTestId('save-toast')
    const labelSpans = stage.querySelectorAll('[aria-live="polite"] > span')
    const joined = Array.from(labelSpans).map((s) => s.textContent).join('')
    expect(joined).toBe('ブックマークレットから開いてください')
  })

  it('renders a blank placeholder (no ring, no brand) during the saving state', () => {
    // Behavior change: during the decision phase the popup shows a blank
    // placeholder — no distracting ring/brand/label. The host-page
    // Shadow-DOM toast injected by the bookmarklet IIFE owns the visible
    // save feedback.
    mockParams = new URLSearchParams({
      url: 'https://example.com',
      title: 'Example',
    })
    render(<SaveToast />)
    const stage = screen.getByTestId('save-toast')
    expect(stage.getAttribute('data-state')).toBe('saving')
    // Ring must NOT appear (blank placeholder, no animation)
    expect(stage.querySelector('[data-role="ring"]')).toBeNull()
    // Brand text must NOT appear
    expect(stage.textContent).not.toContain('AllMarks')
  })

  it('fast-closes after IDB write completes (popup is just an IDB-write bridge)', async () => {
    mockParams = new URLSearchParams({
      url: 'https://example.com',
      title: 'Example',
    })
    // feature OFF so fast-close path is taken
    ;(loadQuickTagEnabled as unknown as { mockResolvedValue: (v: boolean) => void }).mockResolvedValue(false)
    const closeMock = vi.fn()
    Object.defineProperty(window, 'close', { value: closeMock, configurable: true, writable: true })

    render(<SaveToast />)

    // Should close fast (~80ms after IDB write). State stays at 'saving'
    // because the toast animation never advances.
    await waitFor(
      () => {
        expect(closeMock).toHaveBeenCalledTimes(1)
      },
      { timeout: 500 },
    )
    expect(screen.getByTestId('save-toast').getAttribute('data-state')).toBe('saving')
  })

  it('shows error state and waits longer when IDB write fails', async () => {
    // Override the indexeddb mock for this test only
    const { addBookmark } = await import('@/lib/storage/indexeddb')
    vi.mocked(addBookmark).mockRejectedValueOnce(new Error('IDB write failed'))

    mockParams = new URLSearchParams({
      url: 'https://example.com',
      title: 'Example',
    })
    const closeMock = vi.fn()
    Object.defineProperty(window, 'close', { value: closeMock, configurable: true, writable: true })

    render(<SaveToast />)

    // Error state appears
    await waitFor(
      () => {
        expect(screen.getByTestId('save-toast').getAttribute('data-state')).toBe('error')
      },
      { timeout: 500 },
    )
    // Close hasn't fired yet (error path waits ~2.6s)
    expect(closeMock).not.toHaveBeenCalled()
  })

  it('legacy compatibility: previous PiP-active fast-close path still applies', async () => {
    mockParams = new URLSearchParams({
      url: 'https://example.com',
      title: 'Example',
    })
    mockPipActive = true
    const closeMock = vi.fn()
    Object.defineProperty(window, 'close', { value: closeMock, configurable: true, writable: true })

    render(<SaveToast />)

    // Should close fast — well under the ~600ms it would take to reach the 'saved'
    // animation state in the PiP-inactive path.
    await waitFor(
      () => {
        expect(closeMock).toHaveBeenCalledTimes(1)
      },
      { timeout: 500 },
    )

    // State should still be 'saving' when close fired (toast animation skipped).
    expect(screen.getByTestId('save-toast').getAttribute('data-state')).toBe('saving')
  })
})

describe('SaveToast quick-tag branching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    Object.defineProperty(window, 'close', { value: vi.fn(), writable: true, configurable: true })
    Object.defineProperty(window, 'resizeTo', { value: vi.fn(), writable: true, configurable: true })
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: false, media: q, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    }))
    mockParams = new URLSearchParams({ url: 'https://x.com/a/status/1', title: 'Hello' })
    ;(loadQuickTagEnabled as unknown as { mockResolvedValue: (v: boolean) => void }).mockResolvedValue(true)
    ;(queryPipPresence as unknown as { mockResolvedValue: (v: boolean) => void }).mockResolvedValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the tag window when enabled and no PiP', async () => {
    render(<SaveToast />)
    await act(async () => { await vi.runAllTimersAsync() })
    expect(screen.getByTestId('save-tag-window')).toBeTruthy()
    expect(window.close).not.toHaveBeenCalled()
  })

  it('fast-closes when feature is OFF', async () => {
    ;(loadQuickTagEnabled as unknown as { mockResolvedValue: (v: boolean) => void }).mockResolvedValue(false)
    render(<SaveToast />)
    await act(async () => { await vi.runAllTimersAsync() })
    await act(async () => { await vi.advanceTimersByTimeAsync(120) })
    expect(window.close).toHaveBeenCalled()
    expect(screen.queryByTestId('save-tag-window')).toBeNull()
  })

  it('fast-closes when a PiP is open', async () => {
    ;(queryPipPresence as unknown as { mockResolvedValue: (v: boolean) => void }).mockResolvedValue(true)
    render(<SaveToast />)
    await act(async () => { await vi.runAllTimersAsync() })
    await act(async () => { await vi.advanceTimersByTimeAsync(120) })
    expect(window.close).toHaveBeenCalled()
    expect(screen.queryByTestId('save-tag-window')).toBeNull()
  })
})

import { addTagToBookmark } from '@/lib/storage/tags'
import { addBookmark, initDB } from '@/lib/storage/indexeddb'
import { postBookmarkUpdated } from '@/lib/board/channel'

describe('SaveToast lifecycle (Task 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(addBookmark).mockResolvedValue({ id: 'b1', tags: [] } as unknown as Awaited<ReturnType<typeof addBookmark>>)
    Object.defineProperty(window, 'resizeTo', { value: vi.fn(), writable: true, configurable: true })
    Object.defineProperty(window, 'close', { value: vi.fn(), writable: true, configurable: true })
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: false, media: q, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    }))
    mockParams = new URLSearchParams({ url: 'https://x.com/a/status/1', title: 'Hello' })
    ;(loadQuickTagEnabled as unknown as { mockResolvedValue: (v: boolean) => void }).mockResolvedValue(true)
    ;(queryPipPresence as unknown as { mockResolvedValue: (v: boolean) => void }).mockResolvedValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('auto-closes after the untouched timeout when never engaged', async () => {
    vi.useFakeTimers()
    render(<SaveToast />)
    // flush the async save+branch (resolves all mocked promises)
    await act(async () => { await vi.runAllTimersAsync() })
    // flush pending React effects (the lifecycle useEffect sets up the 5s timer here)
    await act(async () => {})
    expect(window.close).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(window.close).toHaveBeenCalled()
  })

  it('cancels the untouched timer once the window is engaged via pointer', async () => {
    vi.useFakeTimers()
    render(<SaveToast />)
    await act(async () => { await vi.runAllTimersAsync() })
    await act(async () => {})
    const win = screen.getByTestId('save-tag-window')
    fireEvent.pointerEnter(win)
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(window.close).not.toHaveBeenCalled()
  })

  it('typing cancels the untouched close timer', async () => {
    vi.useFakeTimers()
    render(<SaveToast />)
    await act(async () => { await vi.runAllTimersAsync() })
    await act(async () => {})
    const win = screen.getByTestId('save-tag-window')
    fireEvent.keyDown(win, { key: 'a' })
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(window.close).not.toHaveBeenCalled()
  })

  it('closes shortly after the pointer leaves once engaged (empty input)', async () => {
    vi.useFakeTimers()
    render(<SaveToast />)
    await act(async () => { await vi.runAllTimersAsync() })
    await act(async () => {})
    const win = screen.getByTestId('save-tag-window')
    // ensure input is empty
    const input = win.querySelector('input')
    if (input) fireEvent.change(input, { target: { value: '' } })
    fireEvent.pointerEnter(win)
    fireEvent.pointerLeave(win)
    await act(async () => { await vi.advanceTimersByTimeAsync(700) })
    expect(window.close).toHaveBeenCalled()
  })

  it('leave with non-empty new-tag input does NOT close (mid-compose guard)', async () => {
    vi.useFakeTimers()
    render(<SaveToast />)
    await act(async () => { await vi.runAllTimersAsync() })
    await act(async () => {})
    const win = screen.getByTestId('save-tag-window')
    const input = win.querySelector('input')
    if (input) fireEvent.change(input, { target: { value: 'abc' } })
    fireEvent.pointerEnter(win)
    fireEvent.pointerLeave(win)
    await act(async () => { await vi.advanceTimersByTimeAsync(700) })
    expect(window.close).not.toHaveBeenCalled()
  })
})

describe('SaveToast blank during decision phase', () => {
  // During state === 'saving' (the decision phase), the popup must show NO
  // distracting content — no ring animation, no brand text, no "保存中…" label.
  // Visible feedback lives in the host-page Shadow-DOM toast injected by the
  // bookmarklet IIFE. The popup is just an IDB-write bridge.
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'resizeTo', { value: vi.fn(), writable: true, configurable: true })
    Object.defineProperty(window, 'close', { value: vi.fn(), configurable: true, writable: true })
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: false, media: q, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    }))
    // Pause async save so we can inspect the initial rendering
    vi.mocked(initDB).mockReturnValue(new Promise(() => { /* never resolves */ }))
    mockParams = new URLSearchParams({ url: 'https://example.com', title: 'Example' })
  })

  afterEach(() => {
    // Restore initDB to its default resolved mock so later describe blocks are unaffected
    vi.mocked(initDB).mockResolvedValue({} as Awaited<ReturnType<typeof initDB>>)
  })

  it('does NOT render ring, brand, or saving label during the decision phase', () => {
    render(<SaveToast />)
    const stage = screen.getByTestId('save-toast')
    // Ring must be absent
    expect(stage.querySelector('[data-role="ring"]')).toBeNull()
    // Brand "AllMarks" text must be absent
    expect(stage.textContent).not.toContain('AllMarks')
    // "保存中…" label must be absent
    expect(stage.textContent).not.toContain('保存中')
  })

  it('still shows data-testid="save-toast" placeholder during decision phase', () => {
    render(<SaveToast />)
    expect(screen.getByTestId('save-toast')).toBeTruthy()
    // No error mark and no tag window either
    expect(screen.queryByTestId('save-tag-window')).toBeNull()
    expect(screen.queryByRole('img', { name: /エラー/ })).toBeNull()
  })
})

describe('SaveToast tag-mode UI (Task 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(addBookmark).mockResolvedValue({ id: 'b1', tags: [] } as unknown as Awaited<ReturnType<typeof addBookmark>>)
    Object.defineProperty(window, 'resizeTo', { value: vi.fn(), writable: true, configurable: true })
    Object.defineProperty(window, 'close', { value: vi.fn(), configurable: true, writable: true })
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: false, media: q, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    }))
    mockParams = new URLSearchParams({ url: 'https://x.com/a/status/1', title: 'Hello' })
    ;(loadQuickTagEnabled as unknown as { mockResolvedValue: (v: boolean) => void }).mockResolvedValue(true)
    ;(queryPipPresence as unknown as { mockResolvedValue: (v: boolean) => void }).mockResolvedValue(false)
  })

  it('applies an existing tag chip and broadcasts update', async () => {
    vi.useRealTimers()
    render(<SaveToast />)
    const win = await screen.findByTestId('save-tag-window')
    const chip = await within(win).findByText('design')
    fireEvent.click(chip)
    await waitFor(() => expect(addTagToBookmark).toHaveBeenCalledWith(expect.anything(), 'b1', 't1'))
  })

  it('closes the window when the close button is pressed', async () => {
    vi.useRealTimers()
    render(<SaveToast />)
    const btn = await screen.findByTestId('save-tag-close')
    fireEvent.click(btn)
    expect(window.close).toHaveBeenCalled()
  })

  it('re-clicking an already-applied chip does NOT write or broadcast again', async () => {
    vi.useRealTimers()
    render(<SaveToast />)
    const win = await screen.findByTestId('save-tag-window')
    const chip = await within(win).findByText('design')
    // First click — genuine apply
    fireEvent.click(chip)
    await waitFor(() => expect(addTagToBookmark).toHaveBeenCalledTimes(1))
    // Clear mocks so we can detect any spurious second call
    vi.clearAllMocks()
    // Second click — tag is now in currentTagIds; should be a no-op
    fireEvent.click(chip)
    // Give any async paths a moment to settle
    await act(async () => {})
    expect(addTagToBookmark).not.toHaveBeenCalled()
    expect(postBookmarkUpdated).not.toHaveBeenCalled()
  })
})
