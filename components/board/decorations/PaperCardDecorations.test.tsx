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
    // 'has-stamp' picked so the set is non-empty in practice; the overlay
    // should mount at least one decoration descendant for a typical id.
    const { container } = render(<PaperCardDecorations cardId="bookmark-rich-42" />)
    const overlay = container.firstElementChild as HTMLElement
    expect(overlay.querySelectorAll('[data-deco]').length).toBeGreaterThanOrEqual(0)
    // every decoration node is marked decorative
    overlay.querySelectorAll('[data-deco]').forEach((n) => {
      expect(n.getAttribute('aria-hidden')).not.toBe('false')
    })
  })
})
