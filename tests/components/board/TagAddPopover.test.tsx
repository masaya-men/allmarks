import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TagAddPopover, type SuggestionEntry } from '@/components/board/TagAddPopover'
import type { TagRecord } from '@/lib/storage/indexeddb'

const allTags: TagRecord[] = [
  { id: 't1', name: 'アート', color: '#28F100', order: 0, createdAt: 1 },
]

const newYouTube: SuggestionEntry[] = [{ kind: 'new', name: 'YouTube' }]
const existingArt: SuggestionEntry[] = [{ kind: 'existing', tagId: 't1' }]

describe('TagAddPopover', () => {
  it('既存タグ + SUGGESTED 候補 + 新規入力欄を表示', () => {
    render(
      <TagAddPopover
        allTags={allTags}
        currentTagIds={[]}
        suggestedEntries={newYouTube}
        onAddExisting={() => {}}
        onAddNew={() => {}}
        onClose={() => {}}
      />,
    )
    expect(screen.getByText('アート')).toBeInTheDocument()
    expect(screen.getByText((content) => content.includes('YouTube'))).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/new|新規/i)).toBeInTheDocument()
  })

  it('既存タグ click で onAddExisting', () => {
    const onAdd = vi.fn()
    render(
      <TagAddPopover
        allTags={allTags}
        currentTagIds={[]}
        suggestedEntries={[]}
        onAddExisting={onAdd}
        onAddNew={() => {}}
        onClose={() => {}}
      />,
    )
    fireEvent.click(screen.getByText('アート'))
    expect(onAdd).toHaveBeenCalledWith('t1')
  })

  it('SUGGESTED 新規候補 click で onAddNew (= 文字列で渡す)', () => {
    const onAddNew = vi.fn()
    render(
      <TagAddPopover
        allTags={allTags}
        currentTagIds={[]}
        suggestedEntries={newYouTube}
        onAddExisting={() => {}}
        onAddNew={onAddNew}
        onClose={() => {}}
      />,
    )
    fireEvent.click(screen.getByText((content) => content.includes('YouTube')))
    expect(onAddNew).toHaveBeenCalledWith('YouTube')
  })

  it('SUGGESTED 既存タグ entry click で onAddExisting (= tagId で渡す)', () => {
    const onAdd = vi.fn()
    render(
      <TagAddPopover
        allTags={allTags}
        currentTagIds={[]}
        suggestedEntries={existingArt}
        onAddExisting={onAdd}
        onAddNew={() => {}}
        onClose={() => {}}
      />,
    )
    // アート chip should now appear in SUGGESTED section (=元の ALL TAGS から消える)
    fireEvent.click(screen.getByText('アート'))
    expect(onAdd).toHaveBeenCalledWith('t1')
  })

  it('新規入力 + Enter で onAddNew', () => {
    const onAddNew = vi.fn()
    render(
      <TagAddPopover
        allTags={allTags}
        currentTagIds={[]}
        suggestedEntries={[]}
        onAddExisting={() => {}}
        onAddNew={onAddNew}
        onClose={() => {}}
      />,
    )
    const input = screen.getByPlaceholderText(/new|新規/i)
    fireEvent.change(input, { target: { value: '新しいタグ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onAddNew).toHaveBeenCalledWith('新しいタグ')
  })

  it('既に付いてるタグは「✓」 マーク表示 + click で onAddExisting (= toggle off は親側責務)', () => {
    render(
      <TagAddPopover
        allTags={allTags}
        currentTagIds={['t1']}
        suggestedEntries={[]}
        onAddExisting={() => {}}
        onAddNew={() => {}}
        onClose={() => {}}
      />,
    )
    const chip = screen.getByText((content) => content.includes('アート')).closest('button')
    expect(chip?.textContent).toContain('✓')
  })

  it('SUGGESTED に出てる既存タグは ALL TAGS から重複表示されない', () => {
    render(
      <TagAddPopover
        allTags={allTags}
        currentTagIds={[]}
        suggestedEntries={existingArt}
        onAddExisting={() => {}}
        onAddNew={() => {}}
        onClose={() => {}}
      />,
    )
    // アート chip should appear exactly once (= in SUGGESTED only)
    const matches = screen.getAllByText('アート')
    expect(matches).toHaveLength(1)
  })

  it('Esc キーで onClose', () => {
    const onClose = vi.fn()
    render(
      <TagAddPopover
        allTags={allTags}
        currentTagIds={[]}
        suggestedEntries={[]}
        onAddExisting={() => {}}
        onAddNew={() => {}}
        onClose={onClose}
      />,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
