import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TagButton } from '@/components/board/TagButton'

describe('TagButton', () => {
  it('MANAGE TAGS ラベル表示', () => {
    render(<TagButton onClick={() => {}} />)
    expect(screen.getByText('MANAGE TAGS')).toBeInTheDocument()
  })

  it('click で onClick 呼ばれる', () => {
    const fn = vi.fn()
    render(<TagButton onClick={fn} />)
    fireEvent.click(screen.getByRole('button'))
    expect(fn).toHaveBeenCalled()
  })

  it('active=true で aria-pressed="true"', () => {
    render(<TagButton onClick={() => {}} active={true} />)
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('aria-pressed')).toBe('true')
  })

  it('active=false で aria-pressed="false"', () => {
    render(<TagButton onClick={() => {}} active={false} />)
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('aria-pressed')).toBe('false')
  })

  it('button 要素で type="button"', () => {
    render(<TagButton onClick={() => {}} />)
    const btn = screen.getByRole('button')
    expect(btn.tagName).toBe('BUTTON')
    expect(btn.getAttribute('type')).toBe('button')
  })
})
