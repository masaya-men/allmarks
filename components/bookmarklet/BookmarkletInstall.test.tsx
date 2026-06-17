import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, fireEvent, cleanup } from '@testing-library/react'
import ja from '@/messages/ja.json'
import type { Messages } from '@/lib/i18n/config'
import { renderWithLocale } from '@/lib/i18n/test-utils'
import { BookmarkletInstall } from './BookmarkletInstall'

afterEach(cleanup)

describe('BookmarkletInstall', () => {
  it('renders the label from i18n', () => {
    renderWithLocale(<BookmarkletInstall onClick={() => {}} />, 'ja', ja as Messages)
    expect(screen.getByText('ブックマークレット')).not.toBeNull()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    renderWithLocale(<BookmarkletInstall onClick={onClick} />, 'ja', ja as Messages)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders a button element (native keyboard activation inherited)', () => {
    renderWithLocale(<BookmarkletInstall onClick={() => {}} />, 'ja', ja as Messages)
    const btn = screen.getByRole('button')
    expect(btn.tagName).toBe('BUTTON')
    expect(btn.getAttribute('type')).toBe('button')
  })
})
