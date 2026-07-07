import { describe, it, expect } from 'vitest'
import { resolveDropTargets, computeTagAssignments } from './tag-assign'

describe('resolveDropTargets', () => {
  it('grabbed card IS selected → tags the whole selection', () => {
    const sel = new Set(['a', 'b', 'c'])
    expect([...resolveDropTargets('b', sel)].sort()).toEqual(['a', 'b', 'c'])
  })

  it('grabbed card is NOT selected → tags just that card', () => {
    const sel = new Set(['a', 'b'])
    expect(resolveDropTargets('z', sel)).toEqual(['z'])
  })

  it('empty selection → tags just the grabbed card', () => {
    expect(resolveDropTargets('a', new Set())).toEqual(['a'])
  })
})

describe('computeTagAssignments', () => {
  const cards = [
    { bookmarkId: 'a', tags: [] as string[] },
    { bookmarkId: 'b', tags: ['t1'] },
    { bookmarkId: 'c', tags: ['t2', 't1'] },
  ]

  it('appends the tag to cards that lack it (union, order preserved)', () => {
    const out = computeTagAssignments(cards, ['a', 'b'], 't1')
    // 'a' gains t1; 'b' already has t1 so it is skipped.
    expect(out).toEqual([{ bookmarkId: 'a', nextTags: ['t1'] }])
  })

  it('keeps existing tags and appends the new one', () => {
    const out = computeTagAssignments(cards, ['c'], 't3')
    expect(out).toEqual([{ bookmarkId: 'c', nextTags: ['t2', 't1', 't3'] }])
  })

  it('skips cards that already carry the tag (no redundant write)', () => {
    expect(computeTagAssignments(cards, ['b'], 't1')).toEqual([])
  })

  it('ignores ids not present in the card set', () => {
    expect(computeTagAssignments(cards, ['ghost'], 't1')).toEqual([])
  })

  it('collapses duplicate ids to a single write', () => {
    const out = computeTagAssignments(cards, ['a', 'a', 'a'], 't9')
    expect(out).toEqual([{ bookmarkId: 'a', nextTags: ['t9'] }])
  })

  it('batch: assigns to every eligible selected card', () => {
    const out = computeTagAssignments(cards, ['a', 'b', 'c'], 't5')
    expect(out).toEqual([
      { bookmarkId: 'a', nextTags: ['t5'] },
      { bookmarkId: 'b', nextTags: ['t1', 't5'] },
      { bookmarkId: 'c', nextTags: ['t2', 't1', 't5'] },
    ])
  })
})
