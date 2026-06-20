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
    expect(screen.getByText('ボードが空です')).not.toBeNull()
  })

  it('renders description and install button', () => {
    renderWithLocale(<EmptyStateWelcome onOpenModal={() => {}} />, 'ja', ja as Messages)
    expect(screen.getByText(/リンクを貼り付け/)).not.toBeNull()
    expect(screen.getByRole('button', { name: '拡張機能なしで保存' })).not.toBeNull()
  })

  it('calls onOpenModal when install button is clicked', () => {
    const onOpenModal = vi.fn()
    renderWithLocale(<EmptyStateWelcome onOpenModal={onOpenModal} />, 'ja', ja as Messages)
    fireEvent.click(screen.getByRole('button', { name: '拡張機能なしで保存' }))
    expect(onOpenModal).toHaveBeenCalledOnce()
  })

  it('does not show REPLAY INTRO without handler', () => {
    renderWithLocale(<EmptyStateWelcome onOpenModal={() => {}} />, 'ja', ja as Messages)
    expect(screen.queryByRole('button', { name: 'REPLAY INTRO' })).toBeNull()
  })

  it('shows REPLAY INTRO only when handler provided', () => {
    const onReplay = vi.fn()
    renderWithLocale(<EmptyStateWelcome onOpenModal={() => {}} onReplayIntro={onReplay} />, 'ja', ja as Messages)
    fireEvent.click(screen.getByRole('button', { name: 'REPLAY INTRO' }))
    expect(onReplay).toHaveBeenCalledOnce()
  })
})
