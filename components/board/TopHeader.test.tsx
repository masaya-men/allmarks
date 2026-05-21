import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TopHeader } from './TopHeader'

describe('TopHeader', () => {
  it('renders two right-side rows (top then bottom)', () => {
    const { getByTestId } = render(
      <TopHeader
        actionsTop={<span data-testid="top-actions">TOP</span>}
        actionsBottom={<span data-testid="bottom-actions">BOTTOM</span>}
      />,
    )
    expect(getByTestId('top-actions')).toBeTruthy()
    expect(getByTestId('bottom-actions')).toBeTruthy()
  })

  it('renders the header root element', () => {
    const { getByTestId, container } = render(
      <TopHeader
        actionsTop={<span data-testid="slot-top">T</span>}
        actionsBottom={<span data-testid="slot-bottom">B</span>}
      />,
    )
    expect(getByTestId('board-top-header')).toBeTruthy()
    expect(getByTestId('slot-top')).toBeTruthy()
    expect(getByTestId('slot-bottom')).toBeTruthy()

    // Verify row order: actions-top comes before actions-bottom in DOM
    const groups = container.querySelectorAll('[data-group]')
    expect(groups.length).toBeGreaterThanOrEqual(2)
    expect((groups[0] as HTMLElement).dataset.group).toBe('actions-top')
    expect((groups[1] as HTMLElement).dataset.group).toBe('actions-bottom')
  })

  it('accepts null in any slot without crashing', () => {
    const { getByTestId } = render(
      <TopHeader actionsTop={null} actionsBottom={null} />,
    )
    expect(getByTestId('board-top-header')).toBeTruthy()
  })
})
