import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PricingPlans } from './PricingPlans'

vi.mock('@/lib/billing/paddle-config', () => ({ getPaddleCheckoutConfig: () => null }))
vi.mock('@/lib/billing/paddle-checkout', () => ({ openPaddleCheckout: vi.fn() }))

afterEach(() => cleanup())

describe('PricingPlans', () => {
  it('renders the billing toggle and three plan cards', () => {
    const { container } = render(<PricingPlans />)
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1)
    expect(container.querySelectorAll('[data-tilt]')).toHaveLength(3)
  })
  it('switches billing cycle via the toggle', () => {
    render(<PricingPlans />)
    const [monthly, annual] = screen.getAllByRole('button').slice(0, 2)
    fireEvent.click(annual)
    expect(annual.getAttribute('aria-pressed')).toBe('true')
    expect(monthly.getAttribute('aria-pressed')).toBe('false')
  })
})
