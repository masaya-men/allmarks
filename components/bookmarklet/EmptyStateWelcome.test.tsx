import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, fireEvent, cleanup } from '@testing-library/react'
import ja from '@/messages/ja.json'
import type { Messages } from '@/lib/i18n/config'
import { renderWithLocale } from '@/lib/i18n/test-utils'
import { EmptyStateWelcome } from './EmptyStateWelcome'

afterEach(cleanup)

describe('EmptyStateWelcome', () => {
  it('renders the title from i18n', () => {
    renderWithLocale(<EmptyStateWelcome onOpenModal={() => {}} />, 'ja', ja as Messages)
    expect(screen.getByText('ブックマークをはじめよう')).not.toBeNull()
  })

  it('renders description and already-installed hint', () => {
    renderWithLocale(<EmptyStateWelcome onOpenModal={() => {}} />, 'ja', ja as Messages)
    expect(screen.getByText(/1 クリックで保存できる/)).not.toBeNull()
    expect(screen.getByText(/既に設置済/)).not.toBeNull()
  })

  it('calls onOpenModal when install button is clicked', () => {
    const onOpenModal = vi.fn()
    renderWithLocale(<EmptyStateWelcome onOpenModal={onOpenModal} />, 'ja', ja as Messages)
    fireEvent.click(screen.getByRole('button', { name: /AllMarks を設置/ }))
    expect(onOpenModal).toHaveBeenCalledOnce()
  })
})
