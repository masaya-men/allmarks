import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PrecisionSlider } from './PrecisionSlider'

describe('PrecisionSlider', () => {
  it('renders the label and `NNNN.NN` zero-padded value with decimals', () => {
    const { container, getByTestId } = render(
      <PrecisionSlider
        label="W"
        min={120}
        max={720}
        value={280}
        onChange={() => {}}
        testId="t-slider"
      />,
    )
    expect(container.textContent).toContain('W')
    // Integer values render as `NNNN.00` (= 2-decimal display, session 39
    // user feedback — sub-integer precision must be visible).
    expect(container.textContent).toContain('0280.00')
    expect(getByTestId('t-slider')).toBeDefined()
  })

  it('renders floats with 2-decimal precision (= sub-integer drag visible)', () => {
    const { container } = render(
      <PrecisionSlider
        label="G"
        min={0}
        max={300}
        value={18.4}
        onChange={() => {}}
        testId="t-slider"
      />,
    )
    // 18.4 → `0018.40` (= the slider's true value, NOT a rounded integer).
    expect(container.textContent).toContain('0018.40')
  })

  it('moves the value by movementX × ratio during drag', () => {
    const onChange = vi.fn()
    const { getByTestId } = render(
      <PrecisionSlider
        label="W"
        min={120}
        max={720}
        value={280}
        onChange={onChange}
        testId="t-slider"
      />,
    )
    const track = getByTestId('t-slider')
    fireEvent.pointerDown(track, { pointerId: 1, clientX: 50 })
    // ratio = (720 - 120) / 10000 = 0.06 (session 39 slowdown — see
    // MOUSE_PX_FOR_FULL_RANGE comment for why we slow it 10×).
    // movementX 100 → +6 → next = 286
    fireEvent.pointerMove(track, { pointerId: 1, movementX: 100 })
    expect(onChange).toHaveBeenLastCalledWith(286)
    fireEvent.pointerUp(track, { pointerId: 1 })
  })

  it('moves 10× faster when Shift is held during drag (= reverse-industry: shift = fast)', () => {
    const onChange = vi.fn()
    const { getByTestId } = render(
      <PrecisionSlider
        label="W"
        min={120}
        max={720}
        value={280}
        onChange={onChange}
        testId="t-slider"
      />,
    )
    const track = getByTestId('t-slider')
    fireEvent.pointerDown(track, { pointerId: 1, clientX: 50 })
    // ratio = 0.06, shift multiplier = 10 → effective 0.6
    // movementX 100 → +60 → next = 340
    fireEvent.pointerMove(track, { pointerId: 1, movementX: 100, shiftKey: true })
    expect(onChange).toHaveBeenLastCalledWith(340)
    fireEvent.pointerUp(track, { pointerId: 1 })
  })

  it('clamps the value at max when overshooting', () => {
    const onChange = vi.fn()
    const { getByTestId } = render(
      <PrecisionSlider
        label="W"
        min={120}
        max={720}
        value={700}
        onChange={onChange}
        testId="t-slider"
      />,
    )
    const track = getByTestId('t-slider')
    fireEvent.pointerDown(track, { pointerId: 1 })
    // ratio = 0.6, movementX = 1000 → +600 → 1300 → clamp to 720
    fireEvent.pointerMove(track, { pointerId: 1, movementX: 1000 })
    expect(onChange).toHaveBeenLastCalledWith(720)
  })

  it('clamps the value at min when undershooting', () => {
    const onChange = vi.fn()
    const { getByTestId } = render(
      <PrecisionSlider
        label="W"
        min={120}
        max={720}
        value={150}
        onChange={onChange}
        testId="t-slider"
      />,
    )
    const track = getByTestId('t-slider')
    fireEvent.pointerDown(track, { pointerId: 1 })
    fireEvent.pointerMove(track, { pointerId: 1, movementX: -1000 })
    expect(onChange).toHaveBeenLastCalledWith(120)
  })

  it('jumps to the click fraction when pointerdown lands on the track (not thumb)', () => {
    const onChange = vi.fn()
    const { getByTestId } = render(
      <PrecisionSlider
        label="W"
        min={120}
        max={720}
        value={280}
        onChange={onChange}
        testId="t-slider"
      />,
    )
    const track = getByTestId('t-slider')
    track.getBoundingClientRect = (): DOMRect => ({
      x: 0, y: 0, width: 200, height: 32, top: 0, right: 200, bottom: 32, left: 0, toJSON: () => ({}),
    } as DOMRect)
    // Click at 50% of track → value jumps to (120 + 0.5 * 600) = 420.
    fireEvent.pointerDown(track, { pointerId: 1, clientX: 100, target: track })
    expect(onChange).toHaveBeenLastCalledWith(420)
  })

  it('does NOT jump when pointerdown lands on the thumb itself', () => {
    const onChange = vi.fn()
    const { container, getByTestId } = render(
      <PrecisionSlider
        label="W"
        min={120}
        max={720}
        value={280}
        onChange={onChange}
        testId="t-slider"
      />,
    )
    const track = getByTestId('t-slider')
    track.getBoundingClientRect = (): DOMRect => ({
      x: 0, y: 0, width: 200, height: 32, top: 0, right: 200, bottom: 32, left: 0, toJSON: () => ({}),
    } as DOMRect)
    // The thumb is the only DOM element with a `left: NN%` inline style
    // among the track's children — find it that way (CSS module class
    // names are hashed in tests).
    const thumb = [...container.querySelectorAll('div')].find((el) => /^\d/.test(el.style.left))
    expect(thumb).toBeDefined()
    fireEvent.pointerDown(track, { pointerId: 1, clientX: 100, target: thumb })
    // pointerdown on the thumb just starts the drag — no jump fires.
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does NOT change value on pointermove without prior pointerdown', () => {
    const onChange = vi.fn()
    const { getByTestId } = render(
      <PrecisionSlider
        label="W"
        min={120}
        max={720}
        value={280}
        onChange={onChange}
        testId="t-slider"
      />,
    )
    const track = getByTestId('t-slider')
    fireEvent.pointerMove(track, { pointerId: 1, movementX: 100 })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('supports arrow-key adjustment (+1 / -1)', () => {
    const onChange = vi.fn()
    const { getByTestId } = render(
      <PrecisionSlider
        label="W"
        min={120}
        max={720}
        value={280}
        onChange={onChange}
        testId="t-slider"
      />,
    )
    const track = getByTestId('t-slider')
    fireEvent.keyDown(track, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith(281)
    fireEvent.keyDown(track, { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenLastCalledWith(279)
    fireEvent.keyDown(track, { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith(281)
    fireEvent.keyDown(track, { key: 'ArrowDown' })
    expect(onChange).toHaveBeenLastCalledWith(279)
  })

  it('supports Home / End to jump to min / max', () => {
    const onChange = vi.fn()
    const { getByTestId } = render(
      <PrecisionSlider
        label="W"
        min={120}
        max={720}
        value={280}
        onChange={onChange}
        testId="t-slider"
      />,
    )
    const track = getByTestId('t-slider')
    fireEvent.keyDown(track, { key: 'Home' })
    expect(onChange).toHaveBeenLastCalledWith(120)
    fireEvent.keyDown(track, { key: 'End' })
    expect(onChange).toHaveBeenLastCalledWith(720)
  })

  it('does not crash when value is NaN', () => {
    const { container } = render(
      <PrecisionSlider
        label="W"
        min={120}
        max={720}
        value={Number.NaN}
        onChange={() => {}}
        testId="t-slider"
      />,
    )
    // falls back to min (= 120) for display, rendered as `0120.00`.
    expect(container.textContent).toContain('0120.00')
  })

  it('sets aria attributes on the track', () => {
    const { getByTestId } = render(
      <PrecisionSlider
        label="G"
        ariaLabel="Card gap"
        min={0}
        max={300}
        value={18}
        onChange={() => {}}
        testId="t-slider"
      />,
    )
    const track = getByTestId('t-slider')
    expect(track.getAttribute('role')).toBe('slider')
    expect(track.getAttribute('aria-valuemin')).toBe('0')
    expect(track.getAttribute('aria-valuemax')).toBe('300')
    expect(track.getAttribute('aria-valuenow')).toBe('18')
    expect(track.getAttribute('aria-label')).toBe('Card gap')
  })
})
