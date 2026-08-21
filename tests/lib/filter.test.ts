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

describe('applyFilter — Private containment', () => {
  function item(overrides: Partial<BoardItem>): BoardItem {
    return {
      bookmarkId: 'b',
      cardId: 'c',
      title: 't',
      url: 'https://x',
      aspectRatio: 1,
      gridIndex: 0,
      orderIndex: 0,
      cardWidth: 240,
      customCardWidth: false,
      isRead: false,
      isDeleted: false,
      tags: [],
      displayMode: null,
      ...overrides,
    }
  }

  const privateItem = item({ bookmarkId: 'priv', tags: ['priv-1', 'travel'] })
  const normalItem = item({ bookmarkId: 'norm', tags: ['travel'] })
  const items = [privateItem, normalItem]

  it('all: Private item never appears even when privateTagId is passed', () => {
    expect(applyFilter(items, { kind: 'all' }, 'priv-1').map((i) => i.bookmarkId)).toEqual(['norm'])
  })

  it('tags filter on a NON-private tag alone excludes the Private item', () => {
    const result = applyFilter(items, { kind: 'tags', tagIds: ['travel'], mode: 'or' }, 'priv-1')
    expect(result.map((i) => i.bookmarkId)).toEqual(['norm'])
  })

  it('tags filter that explicitly includes the Private tag id shows it', () => {
    const result = applyFilter(items, { kind: 'tags', tagIds: ['priv-1'], mode: 'or' }, 'priv-1')
    expect(result.map((i) => i.bookmarkId)).toEqual(['priv'])
  })

  it('tags filter combining Private + travel (AND) shows the Private item', () => {
    const result = applyFilter(items, { kind: 'tags', tagIds: ['priv-1', 'travel'], mode: 'and' }, 'priv-1')
    expect(result.map((i) => i.bookmarkId)).toEqual(['priv'])
  })

  it("privateTagId omitted (default null) preserves today's exact behavior", () => {
    const result = applyFilter(items, { kind: 'tags', tagIds: ['travel'], mode: 'or' })
    expect(result.map((i) => i.bookmarkId).sort()).toEqual(['norm', 'priv'])
  })

  it('inbox: Private item is excluded even when it has no other tags', () => {
    const untaggedPrivate = item({ bookmarkId: 'up', tags: ['priv-1'] })
    const untaggedNormal = item({ bookmarkId: 'un', tags: [] })
    const result = applyFilter([untaggedPrivate, untaggedNormal], { kind: 'inbox' }, 'priv-1')
    expect(result.map((i) => i.bookmarkId)).toEqual(['un'])
  })

  it('archive: Private item stays out of TRASH even when soft-deleted', () => {
    const deletedPrivate = item({ bookmarkId: 'dp', tags: ['priv-1'], isDeleted: true })
    const deletedNormal = item({ bookmarkId: 'dn', tags: [], isDeleted: true })
    const result = applyFilter([deletedPrivate, deletedNormal], { kind: 'archive' }, 'priv-1')
    expect(result.map((i) => i.bookmarkId)).toEqual(['dn'])
  })

  it('dead: Private item is excluded from the broken-link view', () => {
    const deadPrivate = item({ bookmarkId: 'lp', tags: ['priv-1'], linkStatus: 'gone' })
    const deadNormal = item({ bookmarkId: 'ln', tags: [], linkStatus: 'gone' })
    const result = applyFilter([deadPrivate, deadNormal], { kind: 'dead' }, 'priv-1')
    expect(result.map((i) => i.bookmarkId)).toEqual(['ln'])
  })
})
