import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { FaderColumn } from './FaderColumn'

describe('FaderColumn — render', () => {
  it('renders track, handle, default mark, ruler, and label', () => {
    const { container, getByText } = render(
      <FaderColumn
        scope="w"
        value={267.84}
        min={100}
        max={500}
        def={267.84}
        onChange={vi.fn()}
        label="W"
      />,
    )
    expect(container.querySelector('[data-testid="fader-track"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="fader-handle"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="fader-default-mark"]')).not.toBeNull()
    const ruler = container.querySelector('[data-testid="radio-ruler"]')
    expect(ruler).not.toBeNull()
    expect(ruler!.querySelectorAll('[data-tick]').length).toBe(42)
    expect(getByText('W')).toBeTruthy()
  })

  it('handle is at top 50% when value equals default', () => {
    const { container } = render(
      <FaderColumn
        scope="w"
        value={267.84}
        min={100}
        max={500}
        def={267.84}
        onChange={vi.fn()}
        label="W"
      />,
    )
    const handle = container.querySelector('[data-testid="fader-handle"]') as HTMLElement
    expect(handle.style.top).toBe('50%')
  })

  it('handle is at top 25% when value is halfway above default', () => {
    const { container } = render(
      <FaderColumn
        scope="w"
        value={383.92}
        min={100}
        max={500}
        def={267.84}
        onChange={vi.fn()}
        label="W"
      />,
    )
    const handle = container.querySelector('[data-testid="fader-handle"]') as HTMLElement
    expect(handle.style.top).toBe('25%')
  })
})

function mockRect(el: HTMLElement): void {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    top: 0, bottom: 110, left: 0, right: 40, width: 40, height: 110,
    x: 0, y: 0, toJSON: () => ({}),
  } as DOMRect)
}

describe('FaderColumn — drag', () => {
  it('pointerdown then pointermove invokes onChange with vertical delta', () => {
    const onChange = vi.fn()
    const { container } = render(
      <FaderColumn
        scope="w"
        value={267.84}
        min={100}
        max={500}
        def={267.84}
        onChange={onChange}
        label="W"
      />,
    )
    const unit = container.querySelector('[data-scope="w"] > div') as HTMLElement
    mockRect(unit)
    fireEvent.pointerDown(unit, { clientX: 20, clientY: 55, pointerId: 1 })
    fireEvent.pointerMove(unit, { clientX: 20, clientY: 45, movementY: -10, pointerId: 1 })
    expect(onChange).toHaveBeenCalled()
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1]
    expect(lastCall[0]).toBeGreaterThan(267.84)
  })

  it('plain drag is FAST_SPEED_MULTIPLIER (40×) faster than Shift+drag (fine mode)', () => {
    const onChangeNoShift = vi.fn()
    const onChangeShift = vi.fn()
    const { container: c1 } = render(
      <FaderColumn scope="w" value={300} min={100} max={500} def={267.84}
        onChange={onChangeNoShift} label="W" />,
    )
    const { container: c2 } = render(
      <FaderColumn scope="w" value={300} min={100} max={500} def={267.84}
        onChange={onChangeShift} label="W" />,
    )
    const u1 = c1.querySelector('[data-scope="w"] > div') as HTMLElement
    const u2 = c2.querySelector('[data-scope="w"] > div') as HTMLElement
    mockRect(u1)
    mockRect(u2)
    fireEvent.pointerDown(u1, { clientX: 20, clientY: 50, pointerId: 1 })
    fireEvent.pointerMove(u1, { movementY: -50, shiftKey: false, pointerId: 1 })
    fireEvent.pointerDown(u2, { clientX: 20, clientY: 50, pointerId: 1 })
    fireEvent.pointerMove(u2, { movementY: -50, shiftKey: true, pointerId: 1 })
    const lastNo = onChangeNoShift.mock.calls[onChangeNoShift.mock.calls.length - 1][0] as number
    const lastShift = onChangeShift.mock.calls[onChangeShift.mock.calls.length - 1][0] as number
    const noShiftDelta = lastNo - 300
    const shiftDelta = lastShift - 300
    // Iteration 8: speeds inverted — plain drag is now the fast mode,
    // Shift drops to the slow base ratio, so plain ÷ shift ≈ 40.
    expect(Math.abs(noShiftDelta / shiftDelta - 40)).toBeLessThan(0.5)
  })

  it('pointerdown alone does NOT jump (click-to-jump moved to long-press)', () => {
    const onChange = vi.fn()
    const { container } = render(
      <FaderColumn scope="g" value={97.21} min={20} max={200} def={97.21}
        onChange={onChange} label="G" />,
    )
    const unit = container.querySelector('[data-scope="g"] > div') as HTMLElement
    mockRect(unit)
    fireEvent.pointerDown(unit, { clientX: 20, clientY: 0, pointerId: 1 })
    // Immediate jump removed in iteration 7 — pointer-down arms a long-press
    // timer but does not call onChange. The timer fires after 350 ms.
    expect(onChange).not.toHaveBeenCalled()
  })

  it('long-press (≥350 ms) at top of column jumps to max value', () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const { container } = render(
      <FaderColumn scope="g" value={97.21} min={20} max={200} def={97.21}
        onChange={onChange} label="G" />,
    )
    const unit = container.querySelector('[data-scope="g"] > div') as HTMLElement
    mockRect(unit)
    fireEvent.pointerDown(unit, { clientX: 20, clientY: 0, pointerId: 1 })
    vi.advanceTimersByTime(360)
    expect(onChange).toHaveBeenCalledWith(200)
    vi.useRealTimers()
  })

  it('pointer move before long-press fires cancels the jump', () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const { container } = render(
      <FaderColumn scope="g" value={97.21} min={20} max={200} def={97.21}
        onChange={onChange} label="G" />,
    )
    const unit = container.querySelector('[data-scope="g"] > div') as HTMLElement
    mockRect(unit)
    fireEvent.pointerDown(unit, { clientX: 20, clientY: 0, pointerId: 1 })
    // Move > 4 px before the timer fires — should cancel the jump.
    fireEvent.pointerMove(unit, { clientX: 20, clientY: 10, movementY: 10, pointerId: 1 })
    vi.advanceTimersByTime(400)
    // The drag-delta change may have fired, but never the jump-to-max (200).
    expect(onChange.mock.calls.find((c) => c[0] === 200)).toBeUndefined()
    vi.useRealTimers()
  })
})

describe('FaderColumn — ruler tick highlight', () => {
  it('ticks within ±10% of handle have hi class', () => {
    const { container } = render(
      <FaderColumn scope="w" value={267.84} min={100} max={500} def={267.84}
        onChange={vi.fn()} label="W" />,
    )
    const ticks = container.querySelectorAll('[data-tick]')
    const hiTicks = Array.from(ticks).filter((t) =>
      (t as HTMLElement).className.includes('hi'),
    )
    expect(hiTicks.length).toBeGreaterThan(0)
    // 42 ticks × ±10 % window = up to ~9 ticks within range, bumped from 7
    // to keep the assertion accurate after the tick density doubled.
    expect(hiTicks.length).toBeLessThanOrEqual(11)
  })
})
