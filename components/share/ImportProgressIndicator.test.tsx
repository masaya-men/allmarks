import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ImportProgressIndicator } from './ImportProgressIndicator'

describe('ImportProgressIndicator', () => {
  it('renders nothing when idle', () => {
    const { container } = render(<ImportProgressIndicator phase="idle" themeId="default" />)
    expect(container.firstChild).toBeNull()
  })
  it('shows IMPORTING while importing', () => {
    const { getByText, getByTestId } = render(<ImportProgressIndicator phase="importing" themeId="default" />)
    expect(getByText('IMPORTING')).toBeTruthy()
    expect(getByTestId('sound-wave-working')).toBeTruthy()
  })
  it('shows the done check on done', () => {
    const { getByTestId } = render(<ImportProgressIndicator phase="done" themeId="default" />)
    expect(getByTestId('import-done-check')).toBeTruthy()
  })
})
