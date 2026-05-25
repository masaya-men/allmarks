import { describe, it, expect } from 'vitest'
import { applyFilter } from '@/lib/board/filter'
import type { BoardItem } from '@/lib/storage/use-board-data'
import {
  BOARD_FILTER_ALL, BOARD_FILTER_INBOX, BOARD_FILTER_ARCHIVE, makeTagsFilter,
} from '@/lib/board/board-filter-helpers'

function mk(partial: Partial<BoardItem> & { bookmarkId: string; tags?: string[] }): BoardItem {
  return {
    bookmarkId: partial.bookmarkId,
    cardId: 'c-' + partial.bookmarkId,
    title: partial.bookmarkId,
    url: 'https://example.com/' + partial.bookmarkId,
    aspectRatio: 1,
    gridIndex: 0,
    orderIndex: 0,
    cardWidth: 240,
    customCardWidth: false,
    isRead: partial.isRead ?? false,
    isDeleted: partial.isDeleted ?? false,
    tags: partial.tags ?? [],
    displayMode: null,
  } as BoardItem
}

describe('applyFilter', () => {
  const items: BoardItem[] = [
    mk({ bookmarkId: 'a', tags: ['m1'] }),
    mk({ bookmarkId: 'b', tags: [] }),
    mk({ bookmarkId: 'c', tags: ['m2'], isDeleted: true }),
    mk({ bookmarkId: 'd', tags: ['m1', 'm2'] }),
  ]

  it("'all' returns non-deleted items", () => {
    expect(applyFilter(items, BOARD_FILTER_ALL).map((x) => x.bookmarkId)).toEqual(['a', 'b', 'd'])
  })

  it("'inbox' returns non-deleted items with empty tags", () => {
    expect(applyFilter(items, BOARD_FILTER_INBOX).map((x) => x.bookmarkId)).toEqual(['b'])
  })

  it("'archive' returns deleted items only", () => {
    expect(applyFilter(items, BOARD_FILTER_ARCHIVE).map((x) => x.bookmarkId)).toEqual(['c'])
  })

  it('single-tag AND filter returns non-deleted items whose tags include id', () => {
    expect(applyFilter(items, makeTagsFilter(['m1'], 'and')).map((x) => x.bookmarkId)).toEqual(['a', 'd'])
    expect(applyFilter(items, makeTagsFilter(['m2'], 'and')).map((x) => x.bookmarkId)).toEqual(['d']) // c is deleted
  })

  it('multi-tag AND filter keeps only items having ALL specified tags', () => {
    expect(applyFilter(items, makeTagsFilter(['m1', 'm2'], 'and')).map((x) => x.bookmarkId)).toEqual(['d'])
  })

  it('multi-tag OR filter keeps items having ANY specified tag', () => {
    expect(applyFilter(items, makeTagsFilter(['m1', 'm2'], 'or')).map((x) => x.bookmarkId)).toEqual(['a', 'd']) // c excluded by isDeleted
  })

  it('tags filter with empty tagIds falls back to ALL semantics', () => {
    expect(applyFilter(items, makeTagsFilter([], 'and')).map((x) => x.bookmarkId)).toEqual(['a', 'b', 'd'])
  })
})
