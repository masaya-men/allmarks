import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PipStack } from './PipStack'

const cards = [
  { id: '1', title: 'Card 1', thumbnail: '', favicon: '' },
  { id: '2', title: 'Card 2', thumbnail: '', favicon: '' },
  { id: '3', title: 'Card 3', thumbnail: '', favicon: '' },
]

describe('PipStack', () => {
  it('renders every card (no cap) in array (chronological) order', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      id: `c${i}`, title: `t${i}`, thumbnail: '', favicon: '',
    }))
    render(<PipStack cards={many} onCardClick={() => {}} />)
    const stack = screen.getByTestId('pip-stack')
    const items = stack.querySelectorAll('[data-card-id]')
    expect(items).toHaveLength(8)
    expect(items[0].getAttribute('data-card-id')).toBe('c0')
    expect(items[7].getAttribute('data-card-id')).toBe('c7')
  })

  it('starts with the newest (last-appended) card as the active centred slot', () => {
    render(<PipStack cards={cards} onCardClick={() => {}} />)
    expect(screen.getByTestId('pip-stack').getAttribute('data-active-idx')).toBe('2')
  })

  it('clicking the active card fires onCardClick with its id', () => {
    const onCardClick = vi.fn()
    render(<PipStack cards={cards} onCardClick={onCardClick} />)
    // Newest (= last) card is the active one.
    fireEvent.click(screen.getByTestId('pip-card-3'))
    expect(onCardClick).toHaveBeenCalledWith('3')
  })

  it('clicking a non-active card does not fire onCardClick (it scrolls instead)', () => {
    const onCardClick = vi.fn()
    render(<PipStack cards={cards} onCardClick={onCardClick} />)
    // Card '1' is the oldest — not active, click should scroll-to-centre.
    fireEvent.click(screen.getByTestId('pip-card-1'))
    expect(onCardClick).not.toHaveBeenCalled()
  })

  it('shows a single window-level + TAG pill that tags the active card', () => {
    const onOpenTags = vi.fn()
    render(<PipStack cards={cards} onCardClick={() => {}} onOpenTags={onOpenTags} />)
    const btns = screen.getAllByTestId('pip-add-tag-button')
    expect(btns).toHaveLength(1) // one pill for the whole window, not one per card
    fireEvent.click(btns[0])
    expect(onOpenTags).toHaveBeenCalledWith('3') // newest = active
  })

  it('hides the + TAG pill when onOpenTags is not provided', () => {
    render(<PipStack cards={cards} onCardClick={() => {}} />)
    expect(screen.queryByTestId('pip-add-tag-button')).toBeNull()
  })

  it('hides the + TAG pill when tagEnabled is false', () => {
    render(<PipStack cards={cards} onCardClick={() => {}} onOpenTags={() => {}} tagEnabled={false} />)
    expect(screen.queryByTestId('pip-add-tag-button')).toBeNull()
  })

  it('clamps activeIdx and re-centres when the last card is removed', async () => {
    const { rerender } = render(<PipStack cards={cards} onCardClick={() => {}} />)
    // Sanity: latest card (idx 2) is the active centred slot.
    expect(screen.getByTestId('pip-stack').getAttribute('data-active-idx')).toBe('2')
    // Re-render with the last card removed (= board delete fires
    // bookmark-deleted → PipCompanion drops the card from its buffer).
    const shorter = cards.slice(0, 2)
    rerender(<PipStack cards={shorter} onCardClick={() => {}} />)
    // activeIdx 2 was out of bounds — must clamp to len-1 = 1 so the
    // carousel resettles on the now-last card instead of staying parked
    // at the deleted slot's vacated offsetLeft.
    await waitFor(() => {
      expect(screen.getByTestId('pip-stack').getAttribute('data-active-idx')).toBe('1')
    })
  })
})
