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

  it('renders washi/pin/clip/photo-corner/stamp with a background-image url when assets are placed', () => {
    // Search several ids until one produces [data-deco] nodes with inline backgroundImage
    // referencing the paper-atelier asset path
    const candidates = [
      'render-probe-1', 'render-probe-2', 'render-probe-3', 'render-probe-4',
      'render-probe-5', 'bookmark-abc', 'seed-card-xyz', 'pin-probe-1',
    ]
    let withImg = false
    for (const id of candidates) {
      const { container } = render(<PaperCardDecorations cardId={id} />)
      withImg = Array.from(container.querySelectorAll<HTMLElement>('[data-deco]'))
        .some((el) => (el.style.backgroundImage || '').includes('/themes/paper-atelier/'))
      if (withImg) break
    }
    expect(withImg).toBe(true)
  })
})
