import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { MotionToggle } from './MotionToggle'

describe('MotionToggle', () => {
  it('renders MOTION label and reflects on state on the LED', () => {
    const { getByTestId } = render(<MotionToggle enabled onToggle={() => {}} />)
    expect(getByTestId('motion-toggle').getAttribute('data-glitch-text')).toBe('MOTION')
    expect(getByTestId('motion-led').getAttribute('data-on')).toBe('true')
  })
  it('shows LED off when disabled', () => {
    const { getByTestId } = render(<MotionToggle enabled={false} onToggle={() => {}} />)
    expect(getByTestId('motion-led').getAttribute('data-on')).toBe('false')
  })
  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn()
    const { getByTestId } = render(<MotionToggle enabled={false} onToggle={onToggle} />)
    fireEvent.click(getByTestId('motion-toggle'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
