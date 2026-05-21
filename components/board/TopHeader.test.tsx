import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TopHeader } from './TopHeader'

describe('TopHeader', () => {
  it('renders the right-aligned actions row', () => {
    const { getByTestId } = render(
      <TopHeader actions={<span data-testid="actions">ACTIONS</span>} />,
    )
    expect(getByTestId('actions')).toBeTruthy()
  })

  it('renders the header root element with the actions group', () => {
    const { getByTestId, container } = render(
      <TopHeader actions={<span data-testid="slot">A</span>} />,
    )
    expect(getByTestId('board-top-header')).toBeTruthy()
    expect(getByTestId('slot')).toBeTruthy()
    const group = container.querySelector('[data-group="actions"]')
    expect(group).toBeTruthy()
  })

  it('accepts null actions without crashing', () => {
    const { getByTestId } = render(<TopHeader actions={null} />)
    expect(getByTestId('board-top-header')).toBeTruthy()
  })
})
