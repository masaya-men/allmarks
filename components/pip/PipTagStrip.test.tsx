import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PipTagStrip } from './PipTagStrip'
import type { QuickTag } from '@/lib/tagger/order-tags-for-save'

const TAGS: QuickTag[] = [
  { id: 't1', name: 'design', color: '#28f100' },
  { id: 't2', name: 'video', color: '#28f100' },
  { id: 't3', name: 'read-later', color: '#28f100' },
]

describe('PipTagStrip', () => {
  it('renders a chip per tag', () => {
    render(<PipTagStrip tags={TAGS} currentTagIds={[]} onAdd={() => {}} />)
    expect(screen.getByText('design')).toBeTruthy()
    expect(screen.getByText('video')).toBeTruthy()
    expect(screen.getByText('read-later')).toBeTruthy()
  })

  it('marks already-applied tags with a check', () => {
    render(<PipTagStrip tags={TAGS} currentTagIds={['t2']} onAdd={() => {}} />)
    const applied = screen.getByRole('button', { name: /video/ })
    expect(applied.getAttribute('data-has')).toBe('true')
  })

  it('calls onAdd with the tag id when a chip is tapped', () => {
    const onAdd = vi.fn()
    render(<PipTagStrip tags={TAGS} currentTagIds={[]} onAdd={onAdd} />)
    fireEvent.click(screen.getByRole('button', { name: /design/ }))
    expect(onAdd).toHaveBeenCalledWith('t1')
  })

  it('renders nothing when there are no tags', () => {
    const { container } = render(<PipTagStrip tags={[]} currentTagIds={[]} onAdd={() => {}} />)
    expect(container.firstChild).toBeNull()
  })
})
