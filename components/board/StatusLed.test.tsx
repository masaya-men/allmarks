import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { StatusLed } from './StatusLed'

describe('StatusLed', () => {
  it('lit green when on', () => {
    const { getByTestId } = render(<StatusLed on data-testid="led" />)
    expect(getByTestId('led').getAttribute('data-on')).toBe('true')
  })
  it('unlit when off', () => {
    const { getByTestId } = render(<StatusLed on={false} data-testid="led" />)
    expect(getByTestId('led').getAttribute('data-on')).toBe('false')
  })
})
