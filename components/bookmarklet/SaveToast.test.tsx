import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { within, fireEvent } from '@testing-library/react'
import { SaveToast } from './SaveToast'
import { loadQuickTagEnabled } from '@/lib/storage/quick-tag-setting'
import { loadFullscreenNoticeSeen, markFullscreenNoticeSeen } from '@/lib/storage/fullscreen-save-notice'
import { queryPipPresence } from '@/lib/board/pip-presence'
import { addTagToBookmark } from '@/lib/storage/tags'

/** Set the /save window's own viewport — the popup path is ~256×256, a
 *  fullscreen-forced tab is large. isOpenedAsTab reads window.inner{Width,Height}. */
function setViewport(w: number, h: number): void {
  Object.defineProperty(window, 'innerWidth', { value: w, writable: true, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: h, writable: true, configurable: true })
}
const asMock = <T,>(fn: T): { mockResolvedValue: (v: unknown) => void } =>
  fn as unknown as { mockResolvedValue: (v: unknown) => void }

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams({ url: 'https://x.com/a/status/1', title: 'Hi' }),
}))
const saveBookmarkDeduped = vi.fn(async (): Promise<unknown> => ({ outcome: 'saved', bookmark: { id: 'b1', tags: [] } }))
const getAllBookmarks = vi.fn(async () => [] as Array<{ id: string; url: string; isDeleted?: boolean; tags: string[] }>)
vi.mock('@/lib/storage/indexeddb', () => ({
  initDB: vi.fn(async () => ({})),
  saveBookmarkDeduped: (...a: unknown[]) => (saveBookmarkDeduped as (...args: unknown[]) => unknown)(...a),
  getAllBookmarks: (...a: unknown[]) => (getAllBookmarks as (...args: unknown[]) => unknown)(...a),
}))
vi.mock('@/lib/storage/quick-tag-setting', () => ({ loadQuickTagEnabled: vi.fn(async () => false) }))
vi.mock('@/lib/storage/fullscreen-save-notice', () => ({
  loadFullscreenNoticeSeen: vi.fn(async () => false),
  markFullscreenNoticeSeen: vi.fn(async () => {}),
}))
vi.mock('@/lib/board/pip-presence', () => ({ queryPipPresence: vi.fn(async () => false) }))
vi.mock('@/lib/board/channel', () => ({ postBookmarkSaved: vi.fn(), postBookmarkUpdated: vi.fn() }))
vi.mock('@/lib/utils/url', () => ({ detectUrlType: () => 'tweet' }))
vi.mock('@/lib/storage/tags', () => ({
  getAllTags: vi.fn(async () => [{ id: 't1', name: 'design', color: '#fff', order: 0 }]),
  addTagToBookmark: vi.fn(async () => {}),
  addTag: vi.fn(async () => ({ id: 't2', name: 'new', color: '#28F100', order: 1 })),
}))
vi.mock('@/lib/tagger/order-tags-for-save', () => ({
  orderTagsForSave: vi.fn(() => [{ id: 't1', name: 'design', color: '#fff' }]),
}))

async function flush(ms: number): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}

describe('SaveToast deliberate confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    setViewport(256, 256) // windowed popup — not a forced tab
    Object.defineProperty(window, 'close', { value: vi.fn(), writable: true, configurable: true })
    getAllBookmarks.mockResolvedValue([])
    saveBookmarkDeduped.mockResolvedValue({ outcome: 'saved', bookmark: { id: 'b1', tags: [] } })
  })

  it('new save → shows Saved then auto-closes (no tags when feature off)', async () => {
    render(<SaveToast />)
    await flush(500) // min-saving + async work
    expect(screen.getByTestId('save-toast').getAttribute('data-state')).toBe('saved')
    expect(screen.getByTestId('status-label').getAttribute('aria-label')).toBe('Saved')
    expect(window.close).not.toHaveBeenCalled()
    await flush(1900)
    expect(window.close).toHaveBeenCalled()
  })

  it('duplicate (same non-deleted url) → Already saved', async () => {
    saveBookmarkDeduped.mockResolvedValue({ outcome: 'duplicate', bookmark: { id: 'old', url: 'https://x.com/a/status/1', tags: [] } })
    render(<SaveToast />)
    await flush(500)
    expect(screen.getByTestId('save-toast').getAttribute('data-state')).toBe('duplicate')
    expect(screen.getByTestId('status-label').getAttribute('aria-label')).toBe('Already saved')
  })

  it('save failure → Failed then auto-closes', async () => {
    saveBookmarkDeduped.mockRejectedValue(new Error('boom'))
    render(<SaveToast />)
    await flush(500)
    expect(screen.getByTestId('save-toast').getAttribute('data-state')).toBe('error')
    expect(screen.getByTestId('status-label').getAttribute('aria-label')).toBe('Failed')
    await flush(2500)
    expect(window.close).toHaveBeenCalled()
  })
})

describe('SaveToast tag path (enabled + no PiP)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setViewport(256, 256) // windowed popup — not a forced tab
    Object.defineProperty(window, 'close', { value: vi.fn(), writable: true, configurable: true })
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: false, media: q, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    }))
    ;(loadQuickTagEnabled as unknown as { mockResolvedValue: (v: boolean) => void }).mockResolvedValue(true)
    getAllBookmarks.mockResolvedValue([])
    saveBookmarkDeduped.mockResolvedValue({ outcome: 'saved', bookmark: { id: 'b1', tags: [] } })
  })

  it('renders the tag menu and does not auto-close', async () => {
    vi.useFakeTimers()
    render(<SaveToast />)
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })
    const win = screen.getByTestId('save-tag-window')
    expect(within(win).getByText('design')).toBeTruthy()
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(window.close).not.toHaveBeenCalled() // no auto-close while tags shown & untouched-timer not elapsed
  })

  it('applying an existing tag writes through the helper', async () => {
    vi.useRealTimers()
    render(<SaveToast />)
    const win = await screen.findByTestId('save-tag-window')
    fireEvent.click(await within(win).findByText('design'))
    expect(addTagToBookmark).toHaveBeenCalledWith(expect.anything(), 'b1', 't1')
  })

  it('untouched 5s DOES auto-close when no interaction', async () => {
    vi.useFakeTimers()
    render(<SaveToast />)
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })
    // No pointerEnter, no keydown — just wait past the 5000ms threshold
    await act(async () => { await vi.advanceTimersByTimeAsync(5100) })
    expect(window.close).toHaveBeenCalled()
  })

  it('untouched 5s auto-closes; pointerEnter cancels', async () => {
    vi.useFakeTimers()
    render(<SaveToast />)
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })
    fireEvent.pointerEnter(screen.getByTestId('save-tag-window'))
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(window.close).not.toHaveBeenCalled()
  })

  it('close button closes', async () => {
    vi.useRealTimers()
    render(<SaveToast />)
    const btn = await screen.findByTestId('save-tag-close')
    fireEvent.click(btn)
    expect(window.close).toHaveBeenCalled()
  })
})

describe('SaveToast fullscreen forced-tab (macOS Chrome opened us as a tab)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    setViewport(1440, 900) // forced full tab, not the 256×256 popup
    Object.defineProperty(window, 'close', { value: vi.fn(), writable: true, configurable: true })
    asMock(loadQuickTagEnabled).mockResolvedValue(true) // ignored in tab mode
    asMock(queryPipPresence).mockResolvedValue(false)
    asMock(loadFullscreenNoticeSeen).mockResolvedValue(false)
    getAllBookmarks.mockResolvedValue([])
    saveBookmarkDeduped.mockResolvedValue({ outcome: 'saved', bookmark: { id: 'b1', tags: [] } })
  })

  it('no PiP + first time → explains, no tag window, no auto-close, records notice seen', async () => {
    render(<SaveToast />)
    await flush(500)
    expect(screen.getByTestId('save-tab-fullscreen').getAttribute('data-mode')).toBe('tab-explain')
    expect(screen.getByTestId('fs-notice')).toBeTruthy()
    expect(screen.queryByTestId('save-tag-window')).toBeNull()
    expect(markFullscreenNoticeSeen).toHaveBeenCalled()
    await flush(3000)
    expect(window.close).not.toHaveBeenCalled() // manual GOT IT owns the close
  })

  it('GOT IT closes the explanation tab', async () => {
    vi.useRealTimers()
    render(<SaveToast />)
    const btn = await screen.findByTestId('fs-got-it')
    fireEvent.click(btn)
    expect(window.close).toHaveBeenCalled()
  })

  it('no PiP + notice already seen → quiet confirm, auto-closes ~1.3s, no explanation', async () => {
    asMock(loadFullscreenNoticeSeen).mockResolvedValue(true)
    render(<SaveToast />)
    await flush(500)
    expect(screen.getByTestId('save-tab-fullscreen').getAttribute('data-mode')).toBe('tab-confirm')
    expect(screen.queryByTestId('fs-notice')).toBeNull()
    expect(markFullscreenNoticeSeen).not.toHaveBeenCalled()
    expect(window.close).not.toHaveBeenCalled()
    await flush(1400)
    expect(window.close).toHaveBeenCalled()
  })

  it('PiP open → minimal, closes fast (~250ms), no explanation (PopOut shows the card)', async () => {
    asMock(queryPipPresence).mockResolvedValue(true)
    render(<SaveToast />)
    await flush(500)
    expect(screen.getByTestId('save-tab-fullscreen').getAttribute('data-mode')).toBe('tab-minimal')
    expect(screen.queryByTestId('fs-notice')).toBeNull()
    await flush(300)
    expect(window.close).toHaveBeenCalled()
  })
})
