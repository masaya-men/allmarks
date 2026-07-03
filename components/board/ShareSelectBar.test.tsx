import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { ShareSelectBar } from './ShareSelectBar'

const noop = (): void => {}
const baseProps = {
  count: 0,
  capFlashCycle: 0,
  onSelectAll: noop,
  onShare: noop,
  onCancel: noop,
}

describe('ShareSelectBar', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('shows the counter with the shared cap', () => {
    render(<ShareSelectBar {...baseProps} count={7} />)
    expect(screen.getByText('7 / 100 SELECTED')).toBeTruthy()
  })

  it('disables SHARE at 0 and enables it with a count', () => {
    const { rerender } = render(<ShareSelectBar {...baseProps} count={0} />)
    expect((screen.getByTestId('select-share-button') as HTMLButtonElement).disabled).toBe(true)
    rerender(<ShareSelectBar {...baseProps} count={3} />)
    const btn = screen.getByTestId('select-share-button') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    expect(btn.textContent).toContain('SHARE (3)')
  })

  it('fires callbacks', () => {
    const onSelectAll = vi.fn()
    const onShare = vi.fn()
    const onCancel = vi.fn()
    render(<ShareSelectBar {...baseProps} count={1} onSelectAll={onSelectAll} onShare={onShare} onCancel={onCancel} />)
    fireEvent.click(screen.getByTestId('select-all-button'))
    fireEvent.click(screen.getByTestId('select-share-button'))
    fireEvent.click(screen.getByTestId('select-cancel-button'))
    expect(onSelectAll).toHaveBeenCalledOnce()
    expect(onShare).toHaveBeenCalledOnce()
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('does NOT show the cap pill on mount even with a stale non-zero cycle', () => {
    render(<ShareSelectBar {...baseProps} capFlashCycle={3} />)
    expect(screen.queryByText('100 MAX')).toBeNull()
  })

  it('flashes 100 MAX when capFlashCycle bumps, then hides after ~1.6s', () => {
    const { rerender } = render(<ShareSelectBar {...baseProps} capFlashCycle={0} />)
    rerender(<ShareSelectBar {...baseProps} capFlashCycle={1} />)
    expect(screen.getByText('100 MAX')).toBeTruthy()
    act((): void => { vi.advanceTimersByTime(1700) })
    expect(screen.queryByText('100 MAX')).toBeNull()
  })
})
