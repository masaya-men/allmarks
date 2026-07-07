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

  it('handle position is LINEAR in value: midpoint of range sits at top 50%', () => {
    // Linear mapping (no forced-centered default): value at the geometric
    // midpoint of [min, max] sits at the track center. min=100, max=500 →
    // midpoint 300 → 50%.
    const { container } = render(
      <FaderColumn
        scope="w"
        value={300}
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

  it('handle is at top 25% when value is 75% of the way up the range', () => {
    // Linear: value 400 in [100,500] → fraction 0.75 → top (1-0.75)=25%.
    const { container } = render(
      <FaderColumn
        scope="w"
        value={400}
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

  it('default mark sits at the default value position (not forced to 50%)', () => {
    // def=267.84 in [120,720] → fraction 0.2464 → top 75.36%. The mark tracks
    // the real default so reset still has a visual reference.
    const { container } = render(
      <FaderColumn
        scope="w"
        value={267.84}
        min={120}
        max={720}
        def={267.84}
        onChange={vi.fn()}
        label="W"
      />,
    )
    const mark = container.querySelector('[data-testid="fader-default-mark"]') as HTMLElement
    const handle = container.querySelector('[data-testid="fader-handle"]') as HTMLElement
    // When value === def, the handle and the default mark coincide.
    expect(parseFloat(mark.style.top)).toBeCloseTo(parseFloat(handle.style.top), 2)
    expect(parseFloat(mark.style.top)).toBeCloseTo(75.36, 1)
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

describe('FaderColumn — drag symmetry around centered default', () => {
  // Production W params: default is NOT the geometric midpoint of [min, max]
  // (267.84 is closer to 120 than to 720), so the centered-default handle
  // mapping compresses the two halves at different value-scales. Dragging must
  // still move the HANDLE the same visual distance for the same |movementY| in
  // both directions — the value adapts per half, the handle does not. The bug
  // (drag was linear in VALUE, handle position piecewise) made the downward
  // direction ~3× faster than upward.
  const MIN = 120
  const MAX = 720
  const DEF = 267.84

  function dragFrom(value: number, movementY: number): number {
    const onChange = vi.fn()
    const { container } = render(
      <FaderColumn scope="w" value={value} min={MIN} max={MAX} def={DEF}
        onChange={onChange} label="W" />,
    )
    const unit = container.querySelector('[data-scope="w"] > div') as HTMLElement
    mockRect(unit)
    fireEvent.pointerDown(unit, { clientX: 20, clientY: 55, pointerId: 1 })
    fireEvent.pointerMove(unit, { clientX: 20, clientY: 55, movementY, pointerId: 1 })
    expect(onChange).toHaveBeenCalled()
    return onChange.mock.calls[onChange.mock.calls.length - 1][0] as number
  }

  function handleTopPct(value: number): number {
    const { container } = render(
      <FaderColumn scope="w" value={value} min={MIN} max={MAX} def={DEF}
        onChange={vi.fn()} label="W" />,
    )
    const handle = container.querySelector('[data-testid="fader-handle"]') as HTMLElement
    return parseFloat(handle.style.top)
  }

  it('moves the handle symmetrically up vs down for equal mouse travel', () => {
    // Drag up and down by the same |movementY| from the default value; the
    // handle's visual displacement must be equal in both directions. The bug:
    // display was piecewise (centered-default) while drag was linear in value,
    // so downward ran ~3× faster than upward. Measured from the actual starting
    // handle position so it holds regardless of where the default sits.
    const startTop = handleTopPct(DEF)
    const topUp = handleTopPct(dragFrom(DEF, -5))   // movementY < 0 = pointer up = value up
    const topDown = handleTopPct(dragFrom(DEF, 5))  // movementY > 0 = pointer down = value down
    const upDisplacement = startTop - topUp   // handle rose → top decreased
    const downDisplacement = topDown - startTop // handle dropped → top increased
    expect(upDisplacement).toBeGreaterThan(0)
    expect(downDisplacement).toBeGreaterThan(0)
    expect(Math.abs(upDisplacement - downDisplacement)).toBeLessThan(0.05)
  })
})

describe('FaderColumn — fill snap', () => {
  // User's board width: container 1471; W in [120,720]; G held at 97.21.
  const CONTAINER = 1471
  const GAP = 97.21

  it('renders no fill marks when container/other are absent', () => {
    const { container } = render(
      <FaderColumn scope="w" value={267.84} min={120} max={720} def={267.84}
        onChange={vi.fn()} label="W" />,
    )
    expect(container.querySelectorAll('[data-testid="fader-fill-mark"]').length).toBe(0)
  })

  it('renders a fill mark for each even-margin width when enabled', () => {
    const { container } = render(
      <FaderColumn scope="w" value={267.84} min={120} max={720} def={267.84}
        onChange={vi.fn()} label="W" containerWidth={CONTAINER} otherValue={GAP} />,
    )
    const marks = container.querySelectorAll('[data-testid="fader-fill-mark"]')
    // 6 fill widths fall inside [120,720] for gap 97.21 (see fill-snap tests).
    expect(marks.length).toBe(6)
    // One of them is the 4-column fill ≈ 294.84.
    const values = Array.from(marks).map((m) => Number((m as HTMLElement).dataset.fillValue))
    expect(values.some((v) => Math.abs(v - 294.84) < 0.1)).toBe(true)
  })

  it('snaps to the nearest fill width on release when dropped within threshold', () => {
    const onChange = vi.fn()
    const { container } = render(
      <FaderColumn scope="w" value={292} min={120} max={720} def={267.84}
        onChange={onChange} label="W" containerWidth={CONTAINER} otherValue={GAP} />,
    )
    const unit = container.querySelector('[data-scope="w"] > div') as HTMLElement
    mockRect(unit)
    fireEvent.pointerDown(unit, { clientX: 20, clientY: 55, pointerId: 1 })
    fireEvent.pointerUp(unit, { clientX: 20, clientY: 55, pointerId: 1 })
    // 292 is 2.84 px from the 4-column fill 294.84 → snaps.
    const snapped = onChange.mock.calls.find((c) => Math.abs((c[0] as number) - 294.84) < 0.1)
    expect(snapped).toBeTruthy()
  })

  it('does NOT snap when Shift is held on release (precision mode)', () => {
    const onChange = vi.fn()
    const { container } = render(
      <FaderColumn scope="w" value={292} min={120} max={720} def={267.84}
        onChange={onChange} label="W" containerWidth={CONTAINER} otherValue={GAP} />,
    )
    const unit = container.querySelector('[data-scope="w"] > div') as HTMLElement
    mockRect(unit)
    fireEvent.pointerDown(unit, { clientX: 20, clientY: 55, pointerId: 1 })
    fireEvent.pointerUp(unit, { clientX: 20, clientY: 55, shiftKey: true, pointerId: 1 })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does NOT snap a value far from every fill point', () => {
    const onChange = vi.fn()
    const { container } = render(
      <FaderColumn scope="w" value={267.84} min={120} max={720} def={267.84}
        onChange={onChange} label="W" containerWidth={CONTAINER} otherValue={GAP} />,
    )
    const unit = container.querySelector('[data-scope="w"] > div') as HTMLElement
    mockRect(unit)
    fireEvent.pointerDown(unit, { clientX: 20, clientY: 55, pointerId: 1 })
    fireEvent.pointerUp(unit, { clientX: 20, clientY: 55, pointerId: 1 })
    // 267.84 (DEFAULT) is ~27 px from the nearest fill → no onChange.
    expect(onChange).not.toHaveBeenCalled()
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
