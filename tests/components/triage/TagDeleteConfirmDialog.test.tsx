import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TagDeleteConfirmDialog } from '@/components/triage/TagDeleteConfirmDialog'

describe('TagDeleteConfirmDialog', () => {
  const baseProps = {
    tagName: 'YouTube',
    bookmarkCount: 5,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  }

  it('タグ名 + bookmarkCount を含む body', () => {
    render(<TagDeleteConfirmDialog {...baseProps} bookmarkCount={5} />)
    expect(screen.getByText('YouTube')).toBeInTheDocument()
    expect(screen.getByText(/Detach from 5 bookmarks/)).toBeInTheDocument()
  })

  it('bookmarkCount=1 で単数形 "1 bookmark"', () => {
    render(<TagDeleteConfirmDialog {...baseProps} bookmarkCount={1} />)
    expect(screen.getByText(/Detach from 1 bookmark and/)).toBeInTheDocument()
  })

  it('bookmarkCount=0 で empty-tag 専用 phrase', () => {
    render(<TagDeleteConfirmDialog {...baseProps} bookmarkCount={0} />)
    expect(screen.getByText('This tag has no bookmarks.')).toBeInTheDocument()
  })

  it('CANCEL ボタンで onCancel 発火', () => {
    const onCancel = vi.fn()
    render(<TagDeleteConfirmDialog {...baseProps} onCancel={onCancel} />)
    fireEvent.click(screen.getByTestId('tag-delete-cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('backdrop click で onCancel 発火', () => {
    const onCancel = vi.fn()
    render(<TagDeleteConfirmDialog {...baseProps} onCancel={onCancel} />)
    fireEvent.click(screen.getByTestId('tag-delete-confirm-dialog'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('panel 内 click では onCancel 発火しない (= stopPropagation)', () => {
    const onCancel = vi.fn()
    render(<TagDeleteConfirmDialog {...baseProps} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('YouTube'))
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('Esc で onCancel 発火', () => {
    const onCancel = vi.fn()
    render(<TagDeleteConfirmDialog {...baseProps} onCancel={onCancel} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('短い pointerdown → pointerup では onConfirm 発火しない (= 2 秒長押し必須)', () => {
    const onConfirm = vi.fn()
    render(<TagDeleteConfirmDialog {...baseProps} onConfirm={onConfirm} />)
    const btn = screen.getByTestId('tag-delete-confirm') as HTMLButtonElement
    /* jsdom lacks setPointerCapture; stub it so the component's
       onPointerDown can call it without throwing. */
    ;(btn as unknown as { setPointerCapture: () => void }).setPointerCapture = (): void => {}
    fireEvent.pointerDown(btn, { pointerId: 1 })
    fireEvent.pointerUp(btn, { pointerId: 1 })
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
