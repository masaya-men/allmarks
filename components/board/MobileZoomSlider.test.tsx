import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { STAGE_ZOOM_MAX, STAGE_ZOOM_MIN } from '@/lib/share/stage-zoom'
import { MobileZoomSlider } from './MobileZoomSlider'

/** jsdom の getBoundingClientRect は 0 を返すので、トラックに 0..300px の矩形を仕込む。 */
function mockTrackRect(el: HTMLElement): void {
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 300, height: 20, right: 300, bottom: 20, x: 0, y: 0, toJSON: (): object => ({}) }),
  })
}

describe('MobileZoomSlider', () => {
  it('places the thumb at the left at min scale and near the right at max scale', () => {
    const min = render(<MobileZoomSlider scale={STAGE_ZOOM_MIN} onScaleChange={() => {}} />)
    expect((min.getByTestId('mobile-zoom-slider-thumb') as HTMLElement).style.left).toBe('0%')
    min.unmount()
    const max = render(<MobileZoomSlider scale={STAGE_ZOOM_MAX} onScaleChange={() => {}} />)
    expect((max.getByTestId('mobile-zoom-slider-thumb') as HTMLElement).style.left).toBe('100%')
  })

  it('a pointerdown at the track midpoint reports the mid scale', () => {
    const onScaleChange = vi.fn()
    const { getByTestId } = render(<MobileZoomSlider scale={STAGE_ZOOM_MIN} onScaleChange={onScaleChange} />)
    const track = getByTestId('mobile-zoom-slider-track')
    mockTrackRect(track)
    fireEvent.pointerDown(track, { button: 0, pointerId: 1, clientX: 150 }) // 150/300 = 0.5
    const mid = STAGE_ZOOM_MIN + 0.5 * (STAGE_ZOOM_MAX - STAGE_ZOOM_MIN)
    expect(onScaleChange).toHaveBeenLastCalledWith(mid)
  })

  it('dragging past the right edge clamps to max scale', () => {
    const onScaleChange = vi.fn()
    const { getByTestId } = render(<MobileZoomSlider scale={STAGE_ZOOM_MIN} onScaleChange={onScaleChange} />)
    const track = getByTestId('mobile-zoom-slider-track')
    mockTrackRect(track)
    fireEvent.pointerDown(track, { button: 0, pointerId: 1, clientX: 0 })
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 9999 })
    expect(onScaleChange).toHaveBeenLastCalledWith(STAGE_ZOOM_MAX)
    fireEvent.pointerUp(track, { pointerId: 1 })
  })

  it('carries data-no-capture so it never bakes into the share image', () => {
    const { getByTestId } = render(<MobileZoomSlider scale={2} onScaleChange={() => {}} />)
    expect(getByTestId('mobile-zoom-slider').hasAttribute('data-no-capture')).toBe(true)
  })
})
