import { describe, it, expect } from 'vitest'
import {
  BOARD_FILTER_ALL, BOARD_FILTER_INBOX, BOARD_FILTER_ARCHIVE, BOARD_FILTER_DEAD,
  isTagsFilter, makeTagsFilter, boardFilterEquals, getActiveTagIds, toggleTagInFilter,
} from '@/lib/board/board-filter-helpers'

describe('board-filter-helpers', () => {
  it('isTagsFilter recognizes tags kind', () => {
    expect(isTagsFilter(BOARD_FILTER_ALL)).toBe(false)
    expect(isTagsFilter(makeTagsFilter(['t1'], 'and'))).toBe(true)
  })

  it('makeTagsFilter constructs canonical tags filter', () => {
    const f = makeTagsFilter(['t1', 't2'], 'or')
    expect(f).toEqual({ kind: 'tags', tagIds: ['t1', 't2'], mode: 'or' })
  })

  it('boardFilterEquals does structural compare', () => {
    expect(boardFilterEquals(BOARD_FILTER_ALL, BOARD_FILTER_ALL)).toBe(true)
    expect(boardFilterEquals(BOARD_FILTER_ALL, BOARD_FILTER_INBOX)).toBe(false)
    expect(boardFilterEquals(
      makeTagsFilter(['a'], 'and'),
      makeTagsFilter(['a'], 'and'),
    )).toBe(true)
    expect(boardFilterEquals(
      makeTagsFilter(['a'], 'and'),
      makeTagsFilter(['a'], 'or'),
    )).toBe(false)
    expect(boardFilterEquals(
      makeTagsFilter(['a', 'b'], 'and'),
      makeTagsFilter(['b', 'a'], 'and'),
    )).toBe(false)  // order-sensitive on purpose; toggling appends in click order
  })

  it('getActiveTagIds returns the array for tags filters, empty otherwise', () => {
    expect(getActiveTagIds(BOARD_FILTER_ALL)).toEqual([])
    expect(getActiveTagIds(makeTagsFilter(['x', 'y'], 'and'))).toEqual(['x', 'y'])
  })

  it('toggleTagInFilter promotes non-tags filter into single-tag AND', () => {
    expect(toggleTagInFilter(BOARD_FILTER_ALL, 'a'))
      .toEqual({ kind: 'tags', tagIds: ['a'], mode: 'and' })
    expect(toggleTagInFilter(BOARD_FILTER_INBOX, 'a'))
      .toEqual({ kind: 'tags', tagIds: ['a'], mode: 'and' })
  })

  it('toggleTagInFilter appends a new tag id (preserves mode)', () => {
    expect(toggleTagInFilter(makeTagsFilter(['a'], 'or'), 'b'))
      .toEqual({ kind: 'tags', tagIds: ['a', 'b'], mode: 'or' })
  })

  it('toggleTagInFilter removes an existing tag id', () => {
    expect(toggleTagInFilter(makeTagsFilter(['a', 'b'], 'and'), 'a'))
      .toEqual({ kind: 'tags', tagIds: ['b'], mode: 'and' })
  })

  it('toggleTagInFilter collapses to ALL when last tag removed', () => {
    expect(toggleTagInFilter(makeTagsFilter(['only'], 'and'), 'only'))
      .toEqual(BOARD_FILTER_ALL)
  })

  it('exports BOARD_FILTER_DEAD constant', () => {
    expect(BOARD_FILTER_DEAD).toEqual({ kind: 'dead' })
  })

  it('exports BOARD_FILTER_ARCHIVE constant', () => {
    expect(BOARD_FILTER_ARCHIVE).toEqual({ kind: 'archive' })
  })
})
