import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TagFilterBar } from '@/components/board/TagFilterBar'
import type { TagRecord } from '@/lib/storage/indexeddb'

const tags: TagRecord[] = [
  { id: 't1', name: 'アート', color: '#28F100', order: 0, createdAt: 1 },
  { id: 't2', name: '音楽', color: '#28F100', order: 1, createdAt: 2 },
]

describe('TagFilterBar', () => {
  it('全タグの chip を表示', () => {
    render(<TagFilterBar tags={tags} selectedTagIds={[]} mode="and" onToggle={() => {}} onModeChange={() => {}} onClearAll={() => {}} totalCount={0} matchCount={0} />)
    expect(screen.getByText('アート')).toBeInTheDocument()
    expect(screen.getByText('音楽')).toBeInTheDocument()
  })

  it('chip click で onToggle が呼ばれる', () => {
    const onToggle = vi.fn()
    render(<TagFilterBar tags={tags} selectedTagIds={[]} mode="and" onToggle={onToggle} onModeChange={() => {}} onClearAll={() => {}} totalCount={0} matchCount={0} />)
    fireEvent.click(screen.getByText('アート'))
    expect(onToggle).toHaveBeenCalledWith('t1')
  })

  it('選択中タグには data-selected="true" 属性', () => {
    render(<TagFilterBar tags={tags} selectedTagIds={['t1']} mode="and" onToggle={() => {}} onModeChange={() => {}} onClearAll={() => {}} totalCount={10} matchCount={3} />)
    const chip = screen.getByText('アート').closest('[data-selected]')
    expect(chip?.getAttribute('data-selected')).toBe('true')
  })

  it('絞り込み中はカウンタと解除ボタン表示', () => {
    render(<TagFilterBar tags={tags} selectedTagIds={['t1']} mode="and" onToggle={() => {}} onModeChange={() => {}} onClearAll={() => {}} totalCount={47} matchCount={3} />)
    expect(screen.getByText(/47.*3/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /clear|解除/i })).toBeInTheDocument()
  })

  it('AND/OR トグル click で onModeChange', () => {
    const onModeChange = vi.fn()
    render(<TagFilterBar tags={tags} selectedTagIds={['t1', 't2']} mode="and" onToggle={() => {}} onModeChange={onModeChange} onClearAll={() => {}} totalCount={10} matchCount={2} />)
    fireEvent.click(screen.getByRole('button', { name: /AND|OR/i }))
    expect(onModeChange).toHaveBeenCalledWith('or')
  })

  it('タグ 0 件なら bar 自体表示しない', () => {
    const { container } = render(<TagFilterBar tags={[]} selectedTagIds={[]} mode="and" onToggle={() => {}} onModeChange={() => {}} onClearAll={() => {}} totalCount={0} matchCount={0} />)
    expect(container.firstChild).toBeNull()
  })
})
