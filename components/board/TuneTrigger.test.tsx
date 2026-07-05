import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TuneTrigger } from './TuneTrigger'

const baseProps = {
  widthPx: 267.84,
  gapPx: 97.21,
  onChangeWidth: vi.fn(),
  onChangeGap: vi.fn(),
  onReset: vi.fn(),
  onApplyPreset: vi.fn(),
}

describe('TuneTrigger — skeleton', () => {
  it('renders TUNE as a button with proper data-testid in idle state', () => {
    const { getByTestId } = render(
      <TuneTrigger {...baseProps} isOpen={false} onOpenChange={vi.fn()} />,
    )
    const btn = getByTestId('tune-trigger')
    expect(btn.tagName).toBe('BUTTON')
    expect(btn.textContent).toBe('TUNE')
    expect(btn.getAttribute('aria-haspopup')).toBe('dialog')
    expect(btn.getAttribute('aria-expanded')).toBe('false')
  })

  it('does not render the drawer when closed', () => {
    render(<TuneTrigger {...baseProps} isOpen={false} onOpenChange={vi.fn()} />)
    expect(screen.queryByTestId('tune-drawer')).toBeNull()
  })
})

describe('TuneTrigger — click open', () => {
  it('requests open when the trigger is clicked', () => {
    const onOpenChange = vi.fn()
    render(<TuneTrigger {...baseProps} isOpen={false} onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByTestId('tune-trigger'))
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('requests close when the trigger is clicked while open', () => {
    const onOpenChange = vi.fn()
    render(<TuneTrigger {...baseProps} isOpen onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByTestId('tune-trigger'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('renders faders when isOpen', () => {
    render(<TuneTrigger {...baseProps} isOpen onOpenChange={vi.fn()} />)
    expect(screen.getByTestId('tune-drawer')).toBeTruthy()
  })

  it('aria-expanded reflects isOpen', () => {
    render(<TuneTrigger {...baseProps} isOpen onOpenChange={vi.fn()} />)
    expect(screen.getByTestId('tune-trigger').getAttribute('aria-expanded')).toBe('true')
  })
})

describe('TuneTrigger — settled readout while open', () => {
  it('shows flat W/G readout after the scramble settles', async () => {
    const { rerender } = render(<TuneTrigger {...baseProps} isOpen={false} onOpenChange={vi.fn()} />)
    const btn = screen.getByTestId('tune-trigger')
    rerender(<TuneTrigger {...baseProps} isOpen onOpenChange={vi.fn()} />)
    await new Promise<void>((resolve) => setTimeout(resolve, 500))
    expect(btn.querySelector('[data-cell-kind^="num-"]')).toBeNull()
    expect(btn.textContent).toBe('267.84 · 97.21 · DEFAULT')
  })
})

describe('TuneTrigger — close scramble', () => {
  it('closing (isOpen -> false) returns the trigger label to TUNE', async () => {
    const { rerender } = render(<TuneTrigger {...baseProps} isOpen={false} onOpenChange={vi.fn()} />)
    const btn = screen.getByTestId('tune-trigger')
    rerender(<TuneTrigger {...baseProps} isOpen onOpenChange={vi.fn()} />)
    await new Promise<void>((resolve) => setTimeout(resolve, 500))
    expect(btn.textContent).toBe('267.84 · 97.21 · DEFAULT')

    rerender(<TuneTrigger {...baseProps} isOpen={false} onOpenChange={vi.fn()} />)
    await new Promise<void>((resolve) => setTimeout(resolve, 500))
    expect(btn.textContent).toBe('TUNE')
  })
})

describe('TuneTrigger — drawer with FaderColumns', () => {
  it('drawer contains W and G FaderColumns when open', () => {
    render(<TuneTrigger {...baseProps} isOpen onOpenChange={vi.fn()} />)
    const drawer = screen.getByTestId('tune-drawer')
    expect(drawer.querySelector('[data-scope="w"]')).not.toBeNull()
    expect(drawer.querySelector('[data-scope="g"]')).not.toBeNull()
  })

  it('drag on W FaderColumn calls onChangeWidth', () => {
    const onChangeWidth = vi.fn()
    const { container } = render(
      <TuneTrigger {...baseProps} onChangeWidth={onChangeWidth} isOpen onOpenChange={vi.fn()} />,
    )
    const wUnit = container.querySelector('[data-scope="w"] > div') as HTMLElement
    vi.spyOn(wUnit, 'getBoundingClientRect').mockReturnValue({
      top: 0, bottom: 110, left: 0, right: 40, width: 40, height: 110,
      x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect)
    fireEvent.pointerDown(wUnit, { clientX: 20, clientY: 50, pointerId: 1 })
    fireEvent.pointerMove(wUnit, { clientX: 20, clientY: 40, movementY: -10, pointerId: 1 })
    expect(onChangeWidth).toHaveBeenCalled()
  })
})

describe('TuneTrigger — reset', () => {
  it('clicking the ↺ cell calls onReset without toggling the drawer', async () => {
    const onReset = vi.fn()
    const onOpenChange = vi.fn()
    const { container, rerender } = render(
      <TuneTrigger {...baseProps} onReset={onReset} isOpen={false} onOpenChange={onOpenChange} />,
    )
    rerender(<TuneTrigger {...baseProps} onReset={onReset} isOpen onOpenChange={onOpenChange} />)
    await new Promise<void>((resolve) => setTimeout(resolve, 500))
    const resetCell = container.querySelector('[data-cell-kind="reset"]') as HTMLElement
    expect(resetCell).toBeTruthy()
    fireEvent.click(resetCell)
    expect(onReset).toHaveBeenCalledOnce()
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})

describe('TuneTrigger — ChromeDrawer close affordances', () => {
  it('clicking the ChromeDrawer close button requests close', () => {
    const onOpenChange = vi.fn()
    render(<TuneTrigger {...baseProps} isOpen onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByTestId('tune-drawer-close'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
