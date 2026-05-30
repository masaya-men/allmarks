import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RenameTagDialog } from '@/components/triage/RenameTagDialog'

describe('RenameTagDialog', () => {
  const baseProps = {
    currentName: 'music',
    existingNames: ['art', 'code'],
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
  }

  it('pre-fills the input with the current name', () => {
    render(<RenameTagDialog {...baseProps} />)
    expect(screen.getByTestId('tag-rename-input')).toHaveValue('music')
  })

  it('submits the trimmed new name and enables SAVE', () => {
    const onSubmit = vi.fn()
    render(<RenameTagDialog {...baseProps} onSubmit={onSubmit} />)
    const input = screen.getByTestId('tag-rename-input')
    fireEvent.change(input, { target: { value: '  jazz  ' } })
    fireEvent.click(screen.getByTestId('tag-rename-save'))
    expect(onSubmit).toHaveBeenCalledWith('jazz')
  })

  it('submits on Enter', () => {
    const onSubmit = vi.fn()
    render(<RenameTagDialog {...baseProps} onSubmit={onSubmit} />)
    const input = screen.getByTestId('tag-rename-input')
    fireEvent.change(input, { target: { value: 'lofi' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('lofi')
  })

  it('blocks a case-insensitive duplicate of another tag', () => {
    const onSubmit = vi.fn()
    render(<RenameTagDialog {...baseProps} onSubmit={onSubmit} />)
    const input = screen.getByTestId('tag-rename-input')
    fireEvent.change(input, { target: { value: 'ART' } })
    expect(screen.getByTestId('tag-rename-save')).toBeDisabled()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('disables SAVE on an empty name', () => {
    render(<RenameTagDialog {...baseProps} />)
    fireEvent.change(screen.getByTestId('tag-rename-input'), { target: { value: '   ' } })
    expect(screen.getByTestId('tag-rename-save')).toBeDisabled()
  })

  it('allows renaming to the same name (no-op but valid)', () => {
    const onSubmit = vi.fn()
    render(<RenameTagDialog {...baseProps} onSubmit={onSubmit} />)
    fireEvent.click(screen.getByTestId('tag-rename-save'))
    expect(onSubmit).toHaveBeenCalledWith('music')
  })

  it('cancels on Escape', () => {
    const onCancel = vi.fn()
    render(<RenameTagDialog {...baseProps} onCancel={onCancel} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('cancels on backdrop click', () => {
    const onCancel = vi.fn()
    render(<RenameTagDialog {...baseProps} onCancel={onCancel} />)
    fireEvent.click(screen.getByTestId('tag-rename-dialog'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
