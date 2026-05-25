import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TagButton } from '@/components/board/TagButton'

describe('TagButton', () => {
  it('TAG ラベル表示', () => {
    render(<TagButton onClick={() => {}} />)
    expect(screen.getByText('TAG')).toBeInTheDocument()
  })

  it('click で onClick 呼ばれる', () => {
    const fn = vi.fn()
    render(<TagButton onClick={fn} />)
    fireEvent.click(screen.getByRole('button'))
    expect(fn).toHaveBeenCalled()
  })

  it('active=true で data-active="true"', () => {
    render(<TagButton onClick={() => {}} active={true} />)
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('data-active')).toBe('true')
  })

  it('active=false or undefined で data-active="false"', () => {
    render(<TagButton onClick={() => {}} active={false} />)
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('data-active')).toBe('false')
  })

  it('button 要素で type="button"', () => {
    render(<TagButton onClick={() => {}} />)
    const btn = screen.getByRole('button')
    expect(btn.tagName).toBe('BUTTON')
    expect(btn.getAttribute('type')).toBe('button')
  })
})
