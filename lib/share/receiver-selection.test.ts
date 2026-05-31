import { describe, it, expect } from 'vitest'
import { initialIncludeSet, toggleInclude, toggleSenderTag } from './receiver-selection'

describe('receiver-selection', () => {
  it('initialIncludeSet includes all non-duplicate card urls', () => {
    const urls = ['a', 'b', 'c']
    const dups = new Set(['b'])
    expect([...initialIncludeSet(urls, dups)].sort()).toEqual(['a', 'c'])
  })
  it('toggleInclude flips membership', () => {
    const s = new Set(['a'])
    expect(toggleInclude(s, 'a').has('a')).toBe(false)
    expect(toggleInclude(s, 'b').has('b')).toBe(true)
  })
  it('toggleInclude does not mutate the input set', () => {
    const s = new Set(['a'])
    toggleInclude(s, 'a')
    expect(s.has('a')).toBe(true)
  })
  it('toggleSenderTag adds then removes a tag id for one card without mutating input', () => {
    const m = new Map<string, Set<string>>()
    const m1 = toggleSenderTag(m, 'cardA', 't1')
    expect([...(m1.get('cardA') ?? [])]).toEqual(['t1'])
    const m2 = toggleSenderTag(m1, 'cardA', 't1')
    expect(m2.get('cardA')?.has('t1')).toBe(false)
    expect(m1.get('cardA')?.has('t1')).toBe(true) // m1 unchanged
  })
})
