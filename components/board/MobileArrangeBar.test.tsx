import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MobileArrangeBar } from './MobileArrangeBar'

describe('MobileArrangeBar', () => {
  it('fires onBack / onCreate and stays out of the capture', () => {
    const onBack = vi.fn()
    const onCreate = vi.fn()
    render(<MobileArrangeBar onBack={onBack} onCreate={onCreate} creating={false} />)
    expect(screen.getByTestId('mobile-arrange-bar').getAttribute('data-no-capture')).not.toBeNull()
    fireEvent.click(screen.getByTestId('mobile-arrange-back'))
    expect(onBack).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('mobile-arrange-create'))
    expect(onCreate).toHaveBeenCalledTimes(1)
  })

  it('disables CREATE and BACK while creating (no orphan /s from BACK mid-capture)', () => {
    render(<MobileArrangeBar onBack={() => {}} onCreate={() => {}} creating={true} />)
    expect(screen.getByTestId('mobile-arrange-create')).toBeDisabled()
    expect(screen.getByTestId('mobile-arrange-create').textContent).toBe('CREATING…')
    expect(screen.getByTestId('mobile-arrange-back')).toBeDisabled()
  })

  it('shows the tap-select / pinch / slider-zoom hint (N-58 stage 2)', () => {
    render(<MobileArrangeBar onBack={() => {}} onCreate={() => {}} creating={false} />)
    expect(screen.getByText('TAP A CARD TO SELECT — PINCH TO RESIZE OR ROTATE — SLIDER ZOOMS THE BOARD')).toBeTruthy()
  })

  it('renders the zoom slider only when the zoom prop is provided', () => {
    const without = render(<MobileArrangeBar onBack={() => {}} onCreate={() => {}} creating={false} />)
    expect(without.queryByTestId('mobile-zoom-slider')).toBeNull()
    without.unmount()
    const withZoom = render(
      <MobileArrangeBar onBack={() => {}} onCreate={() => {}} creating={false} zoom={{ scale: 2, onScaleChange: () => {} }} />,
    )
    expect(withZoom.getByTestId('mobile-zoom-slider')).toBeTruthy()
  })
})
