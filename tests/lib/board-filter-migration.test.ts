import { describe, it, expect } from 'vitest'
import { migrateLegacyBoardFilter } from '@/lib/board/board-filter-migration'

describe('migrateLegacyBoardFilter', () => {
  it("maps 'all' → { kind: 'all' }", () => {
    expect(migrateLegacyBoardFilter('all')).toEqual({ kind: 'all' })
  })
  it("maps 'inbox' → { kind: 'inbox' }", () => {
    expect(migrateLegacyBoardFilter('inbox')).toEqual({ kind: 'inbox' })
  })
  it("maps 'archive' → { kind: 'archive' }", () => {
    expect(migrateLegacyBoardFilter('archive')).toEqual({ kind: 'archive' })
  })
  it("maps 'dead' → { kind: 'dead' }", () => {
    expect(migrateLegacyBoardFilter('dead')).toEqual({ kind: 'dead' })
  })
  it("maps 'mood:abc' → tags filter [abc] AND", () => {
    expect(migrateLegacyBoardFilter('mood:abc')).toEqual({
      kind: 'tags', tagIds: ['abc'], mode: 'and',
    })
  })
  it('unknown string falls back to all', () => {
    expect(migrateLegacyBoardFilter('garbage')).toEqual({ kind: 'all' })
    expect(migrateLegacyBoardFilter(undefined)).toEqual({ kind: 'all' })
    expect(migrateLegacyBoardFilter(null)).toEqual({ kind: 'all' })
  })
  it('empty mood id falls back to all', () => {
    expect(migrateLegacyBoardFilter('mood:')).toEqual({ kind: 'all' })
  })
  it('already-migrated object passes through unchanged', () => {
    const obj = { kind: 'tags', tagIds: ['x'], mode: 'or' }
    expect(migrateLegacyBoardFilter(obj)).toEqual(obj)
  })
})
