import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
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

describe('ChromeButton — theme-neutral chrome (Task 6)', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme-id')
  })

  it('renders identically regardless of data-theme-id (menus no longer branch on paper)', async () => {
    const { getByTestId } = render(
      <ChromeButton label="SETTINGS" onClick={vi.fn()} data-testid="settings-btn" />,
    )
    const btn = getByTestId('settings-btn')
    expect(btn.textContent).toBe('SETTINGS')

    // Switching to paper-atelier at runtime must not change ChromeButton's own
    // behaviour — the paper branch (useIsPaperTheme) was removed in Task 6, so
    // the chrome vocabulary (label, hover scramble wiring) is theme-agnostic now.
    await act(async () => {
      document.documentElement.setAttribute('data-theme-id', 'paper-atelier')
      await new Promise<void>((r) => setTimeout(r, 0))
    })

    expect(btn.textContent).toBe('SETTINGS')
  })
})
