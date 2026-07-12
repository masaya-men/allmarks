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

  it('disables CREATE while creating', () => {
    render(<MobileArrangeBar onBack={() => {}} onCreate={() => {}} creating={true} />)
    expect(screen.getByTestId('mobile-arrange-create')).toBeDisabled()
    expect(screen.getByTestId('mobile-arrange-create').textContent).toBe('CREATING…')
  })
})
