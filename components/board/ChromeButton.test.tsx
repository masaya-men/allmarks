import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { ChromeButton } from './ChromeButton'

describe('ChromeButton — basic', () => {
  it('renders label and forwards onClick', () => {
    const onClick = vi.fn()
    const { getByText, getByTestId } = render(
      <ChromeButton label="POP OUT" onClick={onClick} data-testid="popout-btn" />,
    )
    expect(getByText('POP OUT')).toBeTruthy()
    fireEvent.click(getByTestId('popout-btn'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('respects disabled prop', () => {
    const onClick = vi.fn()
    const { getByTestId } = render(
      <ChromeButton label="POP OUT" onClick={onClick} disabled data-testid="popout-btn" />,
    )
    const btn = getByTestId('popout-btn') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    fireEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('ChromeButton — idle scramble', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('label still rendered after random scramble timer fires', () => {
    const { getByTestId } = render(
      <ChromeButton label="POP OUT" onClick={vi.fn()} data-testid="popout-btn" />,
    )
    vi.advanceTimersByTime(20000)
    const btn = getByTestId('popout-btn')
    vi.advanceTimersByTime(500)
    expect(btn.textContent).toBe('POP OUT')
  })
})
