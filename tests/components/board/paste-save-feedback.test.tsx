import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PasteSaveFeedback } from '@/components/board/PasteSaveFeedback'

describe('PasteSaveFeedback', () => {
  it('renders nothing when idle', () => {
    const { container } = render(<PasteSaveFeedback feedback={{ kind: null }} themeId="dotted-notebook" />)
    expect(container.firstChild).toBeNull()
  })
  it('shows the theme-driven working visual while loading', () => {
    const { getByTestId } = render(<PasteSaveFeedback feedback={{ kind: 'loading' }} themeId="dotted-notebook" />)
    expect(getByTestId('sound-wave-working')).toBeTruthy()
  })
  it('shows Already saved when duplicate', () => {
    const { getByText } = render(<PasteSaveFeedback feedback={{ kind: 'duplicate' }} themeId="dotted-notebook" />)
    expect(getByText('Already saved')).toBeTruthy()
  })
})
