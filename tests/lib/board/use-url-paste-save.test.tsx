import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('@/lib/storage/indexeddb', () => ({
  initDB: vi.fn(async () => ({})),
  addBookmark: vi.fn(async () => ({ id: 'b1', tags: [] })),
  getAllBookmarks: vi.fn(async () => []),
}))
vi.mock('@/lib/board/paste-ingest', async (orig) => {
  const real = await orig<typeof import('@/lib/board/paste-ingest')>()
  return { ...real, fetchOgpMeta: vi.fn(async () => ({ title: 'T', description: '', image: 'I', siteName: '', favicon: '' })) }
})

import { useUrlPasteSave } from '@/lib/board/use-url-paste-save'
import * as indexeddb from '@/lib/storage/indexeddb'

function paste(text: string, target: EventTarget = document.body): void {
  const e = new Event('paste', { bubbles: true }) as Event & { clipboardData: unknown }
  ;(e as { clipboardData: unknown }).clipboardData = { getData: () => text }
  Object.defineProperty(e, 'target', { value: target })
  document.dispatchEvent(e)
}

describe('useUrlPasteSave', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ingests a pasted website URL and calls onSaved', async () => {
    const onSaved = vi.fn()
    renderHook(() => useUrlPasteSave({ onSaved }))
    act(() => paste('https://example.com'))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('b1'))
  })

  it('ignores paste when target is an input', async () => {
    const onSaved = vi.fn()
    renderHook(() => useUrlPasteSave({ onSaved }))
    const input = document.createElement('input')
    document.body.appendChild(input)
    act(() => paste('https://example.com', input))
    await new Promise((r) => setTimeout(r, 30))
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('ignores non-URL clipboard text', async () => {
    const onSaved = vi.fn()
    renderHook(() => useUrlPasteSave({ onSaved }))
    act(() => paste('hello world'))
    await new Promise((r) => setTimeout(r, 30))
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('sets feedback.kind to duplicate when URL already exists in bookmarks', async () => {
    // Arrange: mock getAllBookmarks to return a bookmark with the same URL
    vi.mocked(indexeddb.getAllBookmarks).mockResolvedValueOnce([
      {
        id: 'existing-1',
        url: 'https://example.com/existing',
        isDeleted: false,
        title: 'Existing',
        description: '',
        thumbnail: '',
        favicon: '',
        siteName: '',
        type: 'website' as const,
        tags: [],
        savedAt: new Date().toISOString(),
        ogpStatus: 'fetched' as const,
      } as import('@/lib/storage/indexeddb').BookmarkRecord,
    ])
    const onSaved = vi.fn()
    const { result } = renderHook(() => useUrlPasteSave({ onSaved }))
    act(() => paste('https://example.com/existing'))
    await waitFor(() => expect(result.current.feedback.kind).toBe('duplicate'))
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('never sets feedback.kind to loading for embeddable URLs (YouTube)', async () => {
    const onSaved = vi.fn()
    const { result } = renderHook(() => useUrlPasteSave({ onSaved }))
    act(() => paste('https://youtu.be/abc12345678'))
    // Give enough time for the async handler to start and possibly set loading
    await new Promise((r) => setTimeout(r, 50))
    // loading must never have been set for embeddable types
    expect(result.current.feedback.kind).not.toBe('loading')
  })
})
