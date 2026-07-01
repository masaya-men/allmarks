import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PaperCardDecorations } from './PaperCardDecorations'

describe('PaperCardDecorations', () => {
  it('renders an aria-hidden overlay', () => {
    const { container } = render(<PaperCardDecorations cardId="seed-1" />)
    const overlay = container.firstElementChild as HTMLElement
    expect(overlay).not.toBeNull()
    expect(overlay.getAttribute('aria-hidden')).toBe('true')
    expect(overlay.className.length).toBeGreaterThan(0)
  })

  it('is deterministic — same id renders identical markup', () => {
    const a = render(<PaperCardDecorations cardId="seed-X" />)
    const b = render(<PaperCardDecorations cardId="seed-X" />)
    expect(a.container.innerHTML).toBe(b.container.innerHTML)
  })

  it('renders EXACTLY ONE fastener per card — a tape or a pin, never both, never none', () => {
    for (let i = 0; i < 60; i++) {
      const { container } = render(<PaperCardDecorations cardId={`one-${i}`} />)
      const tapes = container.querySelectorAll('[data-deco="tape"]').length
      const pins = container.querySelectorAll('[data-deco="pin"]').length
      expect(tapes + pins).toBe(1)
    }
  })

  it('never renders a clip, photo-album corner, or corner tape (removed)', () => {
    for (let i = 0; i < 60; i++) {
      const { container } = render(<PaperCardDecorations cardId={`gone-${i}`} />)
      expect(container.querySelector('[data-deco="clip"]')).toBeNull()
      expect(container.querySelector('[data-deco="photo-corner"]')).toBeNull()
    }
  })

  it('every card has a fastener (no bare cards)', () => {
    for (let i = 0; i < 120; i++) {
      const { container } = render(<PaperCardDecorations cardId={`nobare-${i}`} />)
      const hasFastener =
        container.querySelector('[data-deco="tape"]') !== null ||
        container.querySelector('[data-deco="pin"]') !== null
      expect(hasFastener).toBe(true)
    }
  })

  it('uses the clear cellophane tapes (washi-tape-10/11) somewhere across the board', () => {
    let sawClear = false
    for (let i = 0; i < 200 && !sawClear; i++) {
      const { container } = render(<PaperCardDecorations cardId={`tape-${i}`} />)
      const el = container.querySelector<HTMLElement>('[data-deco="tape"]')
      const bgi = el?.style.backgroundImage || ''
      sawClear = bgi.includes('washi-tape-10') || bgi.includes('washi-tape-11')
    }
    expect(sawClear).toBe(true)
  })

  it('renders the tape with a paper-atelier asset background-image', () => {
    let withImg = false
    for (let i = 0; i < 80 && !withImg; i++) {
      const { container } = render(<PaperCardDecorations cardId={`img-${i}`} />)
      const el = container.querySelector<HTMLElement>('[data-deco="tape"]')
      withImg = (el?.style.backgroundImage || '').includes('/themes/paper-atelier/')
    }
    expect(withImg).toBe(true)
  })

  it('on a torn sheet, never renders a push-pin', () => {
    for (let i = 0; i < 80; i++) {
      const { container } = render(<PaperCardDecorations cardId={`torn-${i}`} tornBacking />)
      expect(container.querySelector('[data-deco="pin"]')).toBeNull()
    }
  })
})
