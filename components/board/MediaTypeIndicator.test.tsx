import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { MediaTypeIndicator } from './MediaTypeIndicator'

describe('MediaTypeIndicator', () => {
  it('renders nothing when type is null', () => {
    const { container } = render(<MediaTypeIndicator type={null} visible={true} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders a non-interactive badge (div) when onActivate is absent', () => {
    const { container } = render(<MediaTypeIndicator type="photo" visible={true} />)
    const el = container.querySelector('[data-testid="media-indicator"]')
    expect(el).not.toBeNull()
    expect(el!.tagName).toBe('DIV')
  })

  it('renders a button and fires onActivate on click for a video card', () => {
    const onActivate = vi.fn()
    const { container } = render(
      <MediaTypeIndicator type="video" visible={true} onActivate={onActivate} active={false} />,
    )
    const btn = container.querySelector('[data-testid="media-indicator"]') as HTMLElement
    expect(btn.tagName).toBe('BUTTON')
    fireEvent.click(btn)
    expect(onActivate).toHaveBeenCalledTimes(1)
  })

  it('stops pointerdown propagation so card reorder/resize do not engage', () => {
    const onActivate = vi.fn()
    const { container } = render(
      <MediaTypeIndicator type="video" visible={true} onActivate={onActivate} active={false} />,
    )
    const btn = container.querySelector('[data-testid="media-indicator"]') as HTMLElement
    const ev = new MouseEvent('pointerdown', { bubbles: true, cancelable: true })
    const stop = vi.spyOn(ev, 'stopPropagation')
    btn.dispatchEvent(ev)
    expect(stop).toHaveBeenCalled()
  })

  it('renders an interactive button for an audio (soundcloud) card', () => {
    const onActivate = vi.fn()
    const { container } = render(
      <MediaTypeIndicator type="audio" visible={true} onActivate={onActivate} active={false} />,
    )
    const btn = container.querySelector('[data-testid="media-indicator"]') as HTMLElement
    expect(btn.tagName).toBe('BUTTON')
    expect(btn.getAttribute('aria-label')).toBe('Play audio')
  })

  it('reflects active state via data-active', () => {
    const { container } = render(
      <MediaTypeIndicator type="video" visible={true} onActivate={() => {}} active={true} />,
    )
    const btn = container.querySelector('[data-testid="media-indicator"]') as HTMLElement
    expect(btn.getAttribute('data-active')).toBe('true')
  })
})
