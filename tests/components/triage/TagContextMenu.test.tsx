import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TagContextMenu } from '@/components/triage/TagContextMenu'

describe('TagContextMenu', () => {
  const baseProps = {
    x: 100,
    y: 100,
    tagName: 'YouTube',
    bookmarkCount: 5,
    onDelete: vi.fn(),
    onClose: vi.fn(),
  }

  it('タグ名が表示される', () => {
    render(<TagContextMenu {...baseProps} />)
    expect(screen.getByText('YouTube')).toBeInTheDocument()
  })

  it('bookmarkCount が複数形で表示 (= "5 USES")', () => {
    render(<TagContextMenu {...baseProps} bookmarkCount={5} />)
    expect(screen.getByText('5 USES')).toBeInTheDocument()
  })

  it('bookmarkCount=1 で単数形 "1 USE"', () => {
    render(<TagContextMenu {...baseProps} bookmarkCount={1} />)
    expect(screen.getByText('1 USE')).toBeInTheDocument()
  })

  it('bookmarkCount=0 で "0 USES"', () => {
    render(<TagContextMenu {...baseProps} bookmarkCount={0} />)
    expect(screen.getByText('0 USES')).toBeInTheDocument()
  })

  it('Delete tag row click で onDelete + onClose 両方発火', () => {
    const onDelete = vi.fn()
    const onClose = vi.fn()
    render(<TagContextMenu {...baseProps} onDelete={onDelete} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('tag-context-menu-delete'))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Esc で onClose 発火', () => {
    const onClose = vi.fn()
    render(<TagContextMenu {...baseProps} onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('panel 外 pointerdown で onClose 発火', () => {
    const onClose = vi.fn()
    render(
      <div>
        <div data-testid="outside-target" />
        <TagContextMenu {...baseProps} onClose={onClose} />
      </div>,
    )
    const outside = screen.getByTestId('outside-target')
    fireEvent.pointerDown(outside)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('panel 内 pointerdown では onClose 発火しない', () => {
    const onClose = vi.fn()
    render(<TagContextMenu {...baseProps} onClose={onClose} />)
    fireEvent.pointerDown(screen.getByTestId('tag-context-menu-delete'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('別 chip (= data-tag-id 持ち) の pointerdown では onClose 発火しない (= 再 aim 用)', () => {
    const onClose = vi.fn()
    render(
      <div>
        <button data-tag-id="other-tag" data-testid="other-chip">other</button>
        <TagContextMenu {...baseProps} onClose={onClose} />
      </div>,
    )
    fireEvent.pointerDown(screen.getByTestId('other-chip'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
