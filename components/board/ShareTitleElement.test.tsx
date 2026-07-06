import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { ShareTitleElement } from './ShareTitleElement'
import { TITLE_DEFAULT_PX, type ShareTitleConfig } from '@/lib/share/share-title'

function makeConfig(overrides: Partial<ShareTitleConfig>): ShareTitleConfig {
  return {
    enabled: true,
    text: null,
    size: TITLE_DEFAULT_PX,
    x: 500,
    y: 300,
    ...overrides,
  }
}

describe('ShareTitleElement', () => {
  it('shows the default text (current filter tag name) when config.text is null', () => {
    const { getByTestId } = render(
      <ShareTitleElement
        config={makeConfig({ text: null })}
        defaultText="my tag"
        onChange={vi.fn()}
      />,
    )
    const root = getByTestId('share-title-element')
    expect(root).not.toBeNull()
    const span = getByTestId('share-title-text')
    // Set via data-wordmark-text (reactive JSX attribute) — the reliable
    // assertion per the task brief, since textContent is synced imperatively.
    expect(span.getAttribute('data-wordmark-text')).toBe('my tag')
    // The imperative ref-sync effect also runs during RTL's render(), so the
    // real DOM textContent should match too.
    expect(span.textContent).toBe('my tag')
  })

  it('renders nothing when the title is disabled', () => {
    const { queryByTestId } = render(
      <ShareTitleElement
        config={makeConfig({ enabled: false })}
        defaultText="my tag"
        onChange={vi.fn()}
      />,
    )
    expect(queryByTestId('share-title-element')).toBeNull()
  })

  it('renders nothing when enabled but the text is cleared and not being edited', () => {
    const { queryByTestId } = render(
      <ShareTitleElement
        config={makeConfig({ enabled: true, text: '' })}
        defaultText="my tag"
        onChange={vi.fn()}
      />,
    )
    expect(queryByTestId('share-title-element')).toBeNull()
  })
})
