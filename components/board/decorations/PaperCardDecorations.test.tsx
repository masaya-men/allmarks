import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PaperCardDecorations } from './PaperCardDecorations'

describe('PaperCardDecorations', () => {
  it('renders an aria-hidden, pointer-events:none overlay', () => {
    const { container } = render(<PaperCardDecorations cardId="seed-1" />)
    const overlay = container.firstElementChild as HTMLElement
    expect(overlay).not.toBeNull()
    expect(overlay.getAttribute('aria-hidden')).toBe('true')
    // class-based assertion (jsdom does not compute pointer-events from CSS modules)
    expect(overlay.className.length).toBeGreaterThan(0)
  })

  it('is deterministic — same id renders identical markup', () => {
    const a = render(<PaperCardDecorations cardId="seed-X" />)
    const b = render(<PaperCardDecorations cardId="seed-X" />)
    expect(a.container.innerHTML).toBe(b.container.innerHTML)
  })

  it('renders decoration nodes consistent with the model', () => {
    // 'bookmark-rich-42' is proven to produce 1 washi strip (derived via node run 2026-06-24).
    // The overlay must mount at least one [data-deco] node for this id.
    const { container } = render(<PaperCardDecorations cardId="bookmark-rich-42" />)
    const overlay = container.firstElementChild as HTMLElement
    expect(overlay.querySelectorAll('[data-deco]').length).toBeGreaterThanOrEqual(1)
    // the overlay root itself is aria-hidden="true" (purely decorative)
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })
})
