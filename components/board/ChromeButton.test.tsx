import { describe, it, expect, vi } from 'vitest'
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

  it('initial render shows the original label (= no scramble in first frame)', () => {
    const { getByTestId } = render(
      <ChromeButton label="SHARE" onClick={vi.fn()} data-testid="share-btn" />,
    )
    expect(getByTestId('share-btn').textContent).toBe('SHARE')
  })
})
