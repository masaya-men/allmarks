import { describe, expect, it } from 'vitest'
import { addAllVisible, selectedInBoardOrder, toggleSelection } from './selection'

const setOf = (...ids: string[]): ReadonlySet<string> => new Set(ids)

describe('toggleSelection', () => {
  it('adds an unselected id', () => {
    const r = toggleSelection(setOf(), 'a')
    expect([...r.ids]).toEqual(['a'])
    expect(r.capped).toBe(false)
  })

  it('removes a selected id', () => {
    const r = toggleSelection(setOf('a', 'b'), 'a')
    expect([...r.ids]).toEqual(['b'])
    expect(r.capped).toBe(false)
  })

  it('refuses to add past the cap and reports capped', () => {
    const full = new Set(Array.from({ length: 3 }, (_, i) => `id${i}`))
    const r = toggleSelection(full, 'newcomer', 3)
    expect(r.ids).toBe(full) // 参照そのまま = 変更なし
    expect(r.capped).toBe(true)
  })

  it('still allows REMOVING when at the cap', () => {
    const full = setOf('a', 'b', 'c')
    const r = toggleSelection(full, 'b', 3)
    expect([...r.ids]).toEqual(['a', 'c'])
    expect(r.capped).toBe(false)
  })

  it('does not mutate the input set', () => {
    const input = new Set(['a'])
    toggleSelection(input, 'b')
    expect([...input]).toEqual(['a'])
  })

  it('defaults max to SHARE_LIMITS_V2.MAX_CARDS (100)', () => {
    const full = new Set(Array.from({ length: 100 }, (_, i) => `id${i}`))
    expect(toggleSelection(full, 'x').capped).toBe(true)
    expect(toggleSelection(new Set(Array.from({ length: 99 }, (_, i) => `id${i}`)), 'x').capped).toBe(false)
  })
})

describe('addAllVisible', () => {
  it('adds all visible ids when under the cap', () => {
    const r = addAllVisible(setOf('z'), ['a', 'b'], 100)
    expect([...r.ids]).toEqual(['z', 'a', 'b'])
    expect(r.capped).toBe(false)
  })

  it('skips already-selected ids without double counting', () => {
    const r = addAllVisible(setOf('a'), ['a', 'b'], 2)
    expect([...r.ids]).toEqual(['a', 'b'])
    expect(r.capped).toBe(false)
  })

  it('fills up to the cap in visible (board) order then reports capped', () => {
    const r = addAllVisible(setOf(), ['a', 'b', 'c', 'd'], 2)
    expect([...r.ids]).toEqual(['a', 'b'])
    expect(r.capped).toBe(true)
  })

  it('reports capped=false when visible fits exactly', () => {
    const r = addAllVisible(setOf(), ['a', 'b'], 2)
    expect(r.capped).toBe(false)
  })
})

describe('selectedInBoardOrder', () => {
  it('returns items in board order regardless of set insertion order', () => {
    const items = [{ bookmarkId: 'new' }, { bookmarkId: 'mid' }, { bookmarkId: 'old' }]
    const ids = new Set(['old', 'new']) // クリック順 = old が先
    expect(selectedInBoardOrder(items, ids).map((i) => i.bookmarkId)).toEqual(['new', 'old'])
  })

  it('ignores ids not present in items', () => {
    const items = [{ bookmarkId: 'a' }]
    expect(selectedInBoardOrder(items, new Set(['a', 'ghost']))).toHaveLength(1)
  })
})
