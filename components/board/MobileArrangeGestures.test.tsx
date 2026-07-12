import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { IDENTITY_STAGE_TRANSFORM } from '@/lib/share/stage-zoom'
import { MobileArrangeGestures, type MobileArrangeGesturesProps } from './MobileArrangeGestures'

/** jsdom の getBoundingClientRect は全て 0 を返すので、覗き窓に 390x844 の矩形を仕込む。 */
function mockRect(el: HTMLElement): void {
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 390, height: 844, right: 390, bottom: 844, x: 0, y: 0, toJSON: (): object => ({}) }),
  })
}

const noop = (): void => {}

function renderGestures(over: Partial<MobileArrangeGesturesProps> = {}): {
  vp: HTMLElement
  onTransformChange: ReturnType<typeof vi.fn>
  onSelectedPinch: ReturnType<typeof vi.fn>
  onSelectedPinchStart: ReturnType<typeof vi.fn>
  onDeselect: ReturnType<typeof vi.fn>
} {
  const onTransformChange = vi.fn()
  const onSelectedPinch = vi.fn()
  const onSelectedPinchStart = vi.fn()
  const onDeselect = vi.fn()
  render(
    <MobileArrangeGestures
      enabled
      transform={IDENTITY_STAGE_TRANSFORM}
      onTransformChange={onTransformChange}
      selectedId={null}
      onSelectedPinchStart={onSelectedPinchStart}
      onSelectedPinch={onSelectedPinch}
      onDeselect={onDeselect}
      {...over}
    >
      <div data-testid="child" />
    </MobileArrangeGestures>,
  )
  const vp = screen.getByTestId('mobile-arrange-viewport')
  mockRect(vp)
  return { vp, onTransformChange, onSelectedPinch, onSelectedPinchStart, onDeselect }
}

describe('MobileArrangeGestures', () => {
  it('renders children without any wrapper when disabled (desktop stays byte-identical)', () => {
    render(
      <MobileArrangeGestures
        enabled={false}
        transform={IDENTITY_STAGE_TRANSFORM}
        onTransformChange={noop}
        selectedId={null}
        onSelectedPinchStart={noop}
        onSelectedPinch={noop}
        onDeselect={noop}
      >
        <div data-testid="child" />
      </MobileArrangeGestures>,
    )
    expect(screen.getByTestId('child')).toBeTruthy()
    expect(screen.queryByTestId('mobile-arrange-viewport')).toBeNull()
    expect(screen.queryByTestId('mobile-arrange-stage')).toBeNull()
  })

  it('applies the transform to the stage layer', () => {
    render(
      <MobileArrangeGestures
        enabled
        transform={{ scale: 2, tx: -10, ty: -20 }}
        onTransformChange={noop}
        selectedId={null}
        onSelectedPinchStart={noop}
        onSelectedPinch={noop}
        onDeselect={noop}
      >
        <div />
      </MobileArrangeGestures>,
    )
    expect(screen.getByTestId('mobile-arrange-stage').style.transform).toBe('translate(-10px, -20px) scale(2)')
  })

  it('with NO card selected, two fingers zoom the stage', () => {
    const { vp, onTransformChange, onSelectedPinch } = renderGestures({ selectedId: null })
    fireEvent.pointerDown(vp, { button: 0, pointerId: 1, clientX: 150, clientY: 400 })
    fireEvent.pointerDown(vp, { button: 0, pointerId: 2, clientX: 250, clientY: 400 }) // dist 100
    fireEvent.pointerMove(vp, { pointerId: 2, clientX: 330, clientY: 400 }) // dist 180 => 1.8x
    expect(onSelectedPinch).not.toHaveBeenCalled()
    expect(onTransformChange).toHaveBeenCalled()
    const last = onTransformChange.mock.calls.at(-1)?.[0] as { scale: number }
    expect(last.scale).toBeCloseTo(1.8)
  })

  it('with a card selected, two fingers transform the card (fires start once + factor)', () => {
    const { vp, onTransformChange, onSelectedPinch, onSelectedPinchStart } = renderGestures({ selectedId: 'a' })
    fireEvent.pointerDown(vp, { button: 0, pointerId: 1, clientX: 150, clientY: 400 })
    expect(onSelectedPinchStart).not.toHaveBeenCalled()
    fireEvent.pointerDown(vp, { button: 0, pointerId: 2, clientX: 250, clientY: 400 }) // dist 100
    expect(onSelectedPinchStart).toHaveBeenCalledTimes(1)
    fireEvent.pointerMove(vp, { pointerId: 2, clientX: 350, clientY: 400 }) // dist 200 => 2x
    expect(onTransformChange).not.toHaveBeenCalled()
    const last = onSelectedPinch.mock.calls.at(-1)?.[0] as { factor: number }
    expect(last.factor).toBeCloseTo(2)
  })

  it('a single finger never pinches (no zoom, no card transform)', () => {
    const { vp, onTransformChange, onSelectedPinch } = renderGestures({ selectedId: 'a' })
    fireEvent.pointerDown(vp, { button: 0, pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(vp, { pointerId: 1, clientX: 300, clientY: 300 })
    expect(onSelectedPinch).not.toHaveBeenCalled()
    // single finger on empty space when zoomed-in would pan, but at scale 1 clamp pins to origin
    // => onTransformChange may fire but must never change scale; here assert no pinch happened.
    for (const c of onTransformChange.mock.calls) {
      expect((c[0] as { scale: number }).scale).toBe(1)
    }
  })

  it('a single-finger tap on empty space deselects', () => {
    const { vp, onDeselect } = renderGestures({ selectedId: 'a' })
    fireEvent.pointerDown(vp, { button: 0, pointerId: 1, clientX: 120, clientY: 120 })
    fireEvent.pointerUp(vp, { pointerId: 1, clientX: 120, clientY: 120 })
    expect(onDeselect).toHaveBeenCalledTimes(1)
  })

  it('with NO card selected, two fingers still fire onSelectedPinchStart once (arbiter cleanup on any pinch)', () => {
    const { vp, onSelectedPinchStart } = renderGestures({ selectedId: null })
    fireEvent.pointerDown(vp, { button: 0, pointerId: 1, clientX: 150, clientY: 400 })
    expect(onSelectedPinchStart).not.toHaveBeenCalled()
    fireEvent.pointerDown(vp, { button: 0, pointerId: 2, clientX: 250, clientY: 400 })
    expect(onSelectedPinchStart).toHaveBeenCalledTimes(1)
  })

  it('a lone finger landing on a card passes through untouched (no deselect, no transform)', () => {
    const onTransformChange = vi.fn()
    const onDeselect = vi.fn()
    render(
      <MobileArrangeGestures
        enabled
        transform={IDENTITY_STAGE_TRANSFORM}
        onTransformChange={onTransformChange}
        selectedId="a"
        onSelectedPinchStart={noop}
        onSelectedPinch={noop}
        onDeselect={onDeselect}
      >
        <div data-testid="collage-el-x" />
      </MobileArrangeGestures>,
    )
    const vp = screen.getByTestId('mobile-arrange-viewport')
    mockRect(vp)
    const card = screen.getByTestId('collage-el-x')
    fireEvent.pointerDown(card, { button: 0, pointerId: 1, clientX: 120, clientY: 120 })
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 200, clientY: 200 })
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 200, clientY: 200 })
    expect(onDeselect).not.toHaveBeenCalled()
    expect(onTransformChange).not.toHaveBeenCalled()
  })

  it('lifting either finger ends the pinch', () => {
    const { vp, onTransformChange } = renderGestures({ selectedId: null })
    fireEvent.pointerDown(vp, { button: 0, pointerId: 1, clientX: 150, clientY: 400 })
    fireEvent.pointerDown(vp, { button: 0, pointerId: 2, clientX: 250, clientY: 400 })
    fireEvent.pointerMove(vp, { pointerId: 2, clientX: 330, clientY: 400 })
    const callsBefore = onTransformChange.mock.calls.length
    fireEvent.pointerUp(vp, { pointerId: 1, clientX: 150, clientY: 400 })
    fireEvent.pointerMove(vp, { pointerId: 2, clientX: 200, clientY: 200 })
    expect(onTransformChange.mock.calls.length).toBe(callsBefore)
  })
})
