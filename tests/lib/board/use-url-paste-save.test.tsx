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
})
