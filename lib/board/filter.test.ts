import { describe, it, expect } from 'vitest'
import { applyFilter } from './filter'
import type { BoardItem } from '@/lib/storage/use-board-data'

function item(id: string, overrides: Partial<BoardItem> = {}): BoardItem {
  return {
    bookmarkId: id, url: `https://x.com/${id}`, title: id, description: '', thumbnail: '',
    favicon: '', siteName: '', type: 'website', savedAt: '2026-01-01T00:00:00.000Z',
    ogpStatus: 'fetched', tags: [], isDeleted: false, linkStatus: 'alive',
    displayMode: null, ...overrides,
  } as BoardItem
}

describe('applyFilter — Private tag hiding', () => {
  it('hides an item tagged with any id in privateTagIds from the all filter', () => {
    const items = [item('a', { tags: ['private-1'] }), item('b', { tags: ['private-2'] }), item('c')]
    const result = applyFilter(items, { kind: 'all' }, new Set(['private-1', 'private-2']))
    expect(result.map((i) => i.bookmarkId)).toEqual(['c'])
  })

  it('shows an item tagged with a private id when that exact tag is the active filter', () => {
    const items = [item('a', { tags: ['private-2'] }), item('b')]
    const result = applyFilter(items, { kind: 'tags', tagIds: ['private-2'], mode: 'or' }, new Set(['private-1', 'private-2']))
    expect(result.map((i) => i.bookmarkId)).toEqual(['a'])
  })

  it('does not leak an item tagged with a DIFFERENT private id into a filter for one specific private tag', () => {
    const items = [item('a', { tags: ['private-1'] }), item('b', { tags: ['private-2'] })]
    const result = applyFilter(items, { kind: 'tags', tagIds: ['private-1'], mode: 'or' }, new Set(['private-1', 'private-2']))
    expect(result.map((i) => i.bookmarkId)).toEqual(['a'])
  })

  it('passes every item through when privateTagIds is empty (no vault set up)', () => {
    const items = [item('a'), item('b', { tags: ['x'] })]
    const result = applyFilter(items, { kind: 'all' }, new Set())
    expect(result).toHaveLength(2)
  })

  it('defaults privateTagIds to an empty set when the third argument is omitted', () => {
    const items = [item('a')]
    expect(applyFilter(items, { kind: 'all' })).toHaveLength(1)
  })

  it('hides a second private tag from an inbox/dead/archive filter the same as the first', () => {
    const items = [
      item('a', { tags: ['private-2'] }),
      item('b', { isDeleted: true, tags: ['private-2'] }),
      item('c', { linkStatus: 'gone', tags: ['private-2'] }),
    ]
    expect(applyFilter(items, { kind: 'inbox' }, new Set(['private-1', 'private-2']))).toHaveLength(0)
    expect(applyFilter(items, { kind: 'archive' }, new Set(['private-1', 'private-2']))).toHaveLength(0)
    expect(applyFilter(items, { kind: 'dead' }, new Set(['private-1', 'private-2']))).toHaveLength(0)
  })
})
