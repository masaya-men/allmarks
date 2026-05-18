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

  it('renders a wrap span with button and empty drawer slot when collapsed', () => {
    const { getByTestId, container } = render(
      <TuneTrigger
        widthPx={267.84}
        gapPx={97.21}
        onChangeWidth={vi.fn()}
        onChangeGap={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    const btn = getByTestId('tune-trigger')
    const wrap = container.querySelector('[data-testid="tune-wrap"]')
    expect(wrap).not.toBeNull()
    expect(wrap?.contains(btn)).toBe(true)
    const drawer = wrap?.querySelector('[data-testid="tune-drawer"]')
    expect(drawer).not.toBeNull()
    expect(drawer?.getAttribute('data-open')).toBe('false')
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
    const wrap = getByTestId('tune-wrap')

    fireEvent.mouseEnter(wrap)
    // Wait for full settle (≈ 21*11ms + 190ms = 421ms), pad to 500ms
    await new Promise<void>((resolve) => setTimeout(resolve, 500))

    expect(btn.getAttribute('aria-expanded')).toBe('true')
    // Settled readout text (whitespace-collapsed cells together)
    expect(btn.textContent).toBe('267.84 · 97.21 · DEFAULT')
  })
})

describe('TuneTrigger — close on mouseleave', () => {
  it('mouseleave after 1000ms grace returns to idle TUNE label', async () => {
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
    const wrap = getByTestId('tune-wrap')

    fireEvent.mouseEnter(wrap)
    await new Promise<void>((resolve) => setTimeout(resolve, 500))
    expect(btn.textContent).toBe('267.84 · 97.21 · DEFAULT')

    fireEvent.mouseLeave(wrap)
    // Wait grace (1000ms) + close animation (≈ 21*11 + 190 = 421ms) = ~1500ms safe
    await new Promise<void>((resolve) => setTimeout(resolve, 1500))
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
    const wrap = getByTestId('tune-wrap')
    fireEvent.mouseEnter(wrap)
    await new Promise<void>((resolve) => setTimeout(resolve, 500))
    fireEvent.mouseLeave(wrap)
    // Re-enter during grace
    await new Promise<void>((resolve) => setTimeout(resolve, 50))
    fireEvent.mouseEnter(wrap)
    await new Promise<void>((resolve) => setTimeout(resolve, 200))
    expect(btn.getAttribute('aria-expanded')).toBe('true')
  })
})

describe('TuneTrigger — drag-scrub', () => {
  it('pointerdown + pointermove on a W num cell calls onChangeWidth with delta', async () => {
    const onChangeWidth = vi.fn()
    const { getByTestId, container } = render(
      <TuneTrigger
        widthPx={267.84}
        gapPx={97.21}
        onChangeWidth={onChangeWidth}
        onChangeGap={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    const btn = getByTestId('tune-trigger')
    const wrap = getByTestId('tune-wrap')
    fireEvent.mouseEnter(wrap)
    await new Promise<void>((resolve) => setTimeout(resolve, 500))

    // Find the first .num cell tagged for W
    const numCells = container.querySelectorAll('[data-cell-kind="num-w"]')
    expect(numCells.length).toBeGreaterThan(0)
    const target = numCells[0] as HTMLElement

    fireEvent.pointerDown(target, { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(target, { pointerId: 1, clientX: 200, clientY: 100, movementX: 100 })
    fireEvent.pointerUp(target, { pointerId: 1, clientX: 200, clientY: 100 })

    expect(onChangeWidth).toHaveBeenCalled()
    // Amendment 1: ratio = (max - min) / 30000 = (720 - 120) / 30000 = 0.02
    // delta = 100 * 0.02 = 2 → next = 267.84 + 2 = 269.84
    const lastCall = onChangeWidth.mock.calls[onChangeWidth.mock.calls.length - 1]
    expect(lastCall[0]).toBeCloseTo(269.84, 1)
  })
})

describe('TuneTrigger — reset and sticky', () => {
  it('clicking the ↺ cell calls onReset', async () => {
    const onReset = vi.fn()
    const { getByTestId, container } = render(
      <TuneTrigger
        widthPx={267.84}
        gapPx={97.21}
        onChangeWidth={vi.fn()}
        onChangeGap={vi.fn()}
        onReset={onReset}
      />,
    )
    const btn = getByTestId('tune-trigger')
    const wrap = getByTestId('tune-wrap')
    fireEvent.mouseEnter(wrap)
    await new Promise<void>((resolve) => setTimeout(resolve, 500))

    const resetCell = container.querySelector('[data-cell-kind="reset"]') as HTMLElement
    expect(resetCell).toBeTruthy()
    fireEvent.click(resetCell)
    expect(onReset).toHaveBeenCalledOnce()
  })

  it('clicking the TUNE button toggles sticky open (mouseleave does not close)', async () => {
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
    const wrap = getByTestId('tune-wrap')

    fireEvent.mouseEnter(wrap)
    await new Promise<void>((resolve) => setTimeout(resolve, 500))
    fireEvent.click(btn)
    // Sticky now ON — leave should NOT close
    fireEvent.mouseLeave(wrap)
    await new Promise<void>((resolve) => setTimeout(resolve, 700))
    expect(btn.getAttribute('aria-expanded')).toBe('true')
  })

  it('ESC closes a sticky-open readout', async () => {
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
    const wrap = getByTestId('tune-wrap')
    fireEvent.mouseEnter(wrap)
    await new Promise<void>((resolve) => setTimeout(resolve, 500))
    fireEvent.click(btn)
    fireEvent.keyDown(window, { key: 'Escape' })
    await new Promise<void>((resolve) => setTimeout(resolve, 700))
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(btn.textContent).toBe('TUNE')
  })
})
