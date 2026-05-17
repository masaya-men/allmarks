import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { TuneTrigger } from './TuneTrigger'

describe('TuneTrigger — skeleton', () => {
  it('renders TUNE as a button with proper data-testid in idle state', () => {
    const { getByTestId } = render(
      <TuneTrigger
        widthPx={267.84}
        gapPx={97.21}
        onChangeWidth={vi.fn()}
        onChangeGap={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    const btn = getByTestId('tune-trigger')
    expect(btn.tagName).toBe('BUTTON')
    expect(btn.textContent).toBe('TUNE')
    expect(btn.getAttribute('aria-haspopup')).toBe('dialog')
    expect(btn.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('TuneTrigger — hover open', () => {
  it('on mouseenter, expands aria-expanded=true and renders the W/G readout', async () => {
    const { getByTestId } = render(
      <TuneTrigger
        widthPx={267.84}
        gapPx={97.21}
        onChangeWidth={vi.fn()}
        onChangeGap={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    const btn = getByTestId('tune-trigger')

    fireEvent.mouseEnter(btn)
    // Wait for full settle (≈ 21*11ms + 190ms = 421ms), pad to 500ms
    await new Promise<void>((resolve) => setTimeout(resolve, 500))

    expect(btn.getAttribute('aria-expanded')).toBe('true')
    // Settled readout text (whitespace-collapsed cells together)
    expect(btn.textContent).toBe('W 267.84 · G 97.21 · ↺')
  })
})

describe('TuneTrigger — close on mouseleave', () => {
  it('mouseleave after 180ms grace returns to idle TUNE label', async () => {
    const { getByTestId } = render(
      <TuneTrigger
        widthPx={267.84}
        gapPx={97.21}
        onChangeWidth={vi.fn()}
        onChangeGap={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    const btn = getByTestId('tune-trigger')

    fireEvent.mouseEnter(btn)
    await new Promise<void>((resolve) => setTimeout(resolve, 500))
    expect(btn.textContent).toBe('W 267.84 · G 97.21 · ↺')

    fireEvent.mouseLeave(btn)
    // Wait grace (180ms) + close animation (≈ 21*11 + 190 = 421ms) = ~700ms safe
    await new Promise<void>((resolve) => setTimeout(resolve, 700))
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(btn.textContent).toBe('TUNE')
  })

  it('mouseenter during grace cancels the pending close', async () => {
    const { getByTestId } = render(
      <TuneTrigger
        widthPx={267.84}
        gapPx={97.21}
        onChangeWidth={vi.fn()}
        onChangeGap={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    const btn = getByTestId('tune-trigger')
    fireEvent.mouseEnter(btn)
    await new Promise<void>((resolve) => setTimeout(resolve, 500))
    fireEvent.mouseLeave(btn)
    // Re-enter during grace
    await new Promise<void>((resolve) => setTimeout(resolve, 50))
    fireEvent.mouseEnter(btn)
    await new Promise<void>((resolve) => setTimeout(resolve, 200))
    expect(btn.getAttribute('aria-expanded')).toBe('true')
  })
})
