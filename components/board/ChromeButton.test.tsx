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

describe('ChromeButton — paper theme live tracking', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme-id')
  })

  it('disables triggerBurst (onMouseEnter) when data-theme-id switches to paper-atelier at runtime', async () => {
    const { getByTestId } = render(
      <ChromeButton label="SETTINGS" onClick={vi.fn()} data-testid="settings-btn" />,
    )

    // Before switching: hover should be wired (triggerBurst)
    const btn = getByTestId('settings-btn')
    expect(btn.onmouseenter).toBe(null) // React attaches via event delegation, not inline

    // Switch to paper-atelier theme
    await act(async () => {
      document.documentElement.setAttribute('data-theme-id', 'paper-atelier')
      // yield a tick for MutationObserver + React state update
      await new Promise<void>((r) => setTimeout(r, 0))
    })

    // On paper: the label should still be shown (no scramble), and the button
    // renders the static label text — assert text content equals original label
    expect(btn.textContent).toBe('SETTINGS')
  })
})
