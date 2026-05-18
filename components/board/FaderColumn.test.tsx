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
    expect(ruler!.querySelectorAll('[data-tick]').length).toBe(22)
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

  it('Shift+pointermove applies SHIFT_SPEED_MULTIPLIER factor', () => {
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
    expect(Math.abs(shiftDelta / noShiftDelta - 40)).toBeLessThan(0.5)
  })

  it('pointerdown at top of column jumps to max value', () => {
    const onChange = vi.fn()
    const { container } = render(
      <FaderColumn scope="g" value={97.21} min={20} max={200} def={97.21}
        onChange={onChange} label="G" />,
    )
    const unit = container.querySelector('[data-scope="g"] > div') as HTMLElement
    mockRect(unit)
    fireEvent.pointerDown(unit, { clientX: 20, clientY: 0, pointerId: 1 })
    expect(onChange).toHaveBeenCalledWith(200)
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
    expect(hiTicks.length).toBeLessThanOrEqual(7)
  })
})
