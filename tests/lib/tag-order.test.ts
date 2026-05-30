import { describe, it, expect } from 'vitest'
import { sortTagsByMode, nextTagOrderMode, DEFAULT_TAG_ORDER_MODE } from '@/lib/board/tag-order'
import type { TagRecord } from '@/lib/storage/indexeddb'

function tag(name: string, order: number): TagRecord {
  return { id: name, name, color: '#888', order, createdAt: 0, updatedAt: 0, theme: null }
}

describe('sortTagsByMode', () => {
  // Deliberately out of both alpha and order so each mode is distinguishable.
  const tags: TagRecord[] = [
    tag('music', 2),
    tag('art', 0),
    tag('code', 1),
  ]

  it('auto-asc sorts by name ascending (ignores the order field)', () => {
    expect(sortTagsByMode(tags, 'auto-asc').map((t) => t.name)).toEqual(['art', 'code', 'music'])
  })

  it('auto-desc sorts by name descending', () => {
    expect(sortTagsByMode(tags, 'auto-desc').map((t) => t.name)).toEqual(['music', 'code', 'art'])
  })

  it('manual sorts by the order field', () => {
    expect(sortTagsByMode(tags, 'manual').map((t) => t.name)).toEqual(['art', 'code', 'music'])
    const reordered = [tag('music', 0), tag('art', 1), tag('code', 2)]
    expect(sortTagsByMode(reordered, 'manual').map((t) => t.name)).toEqual(['music', 'art', 'code'])
  })

  it('orders Japanese kana in あ→ん order in auto-asc', () => {
    const jp = [tag('さくら', 0), tag('あさ', 1), tag('かぜ', 2)]
    expect(sortTagsByMode(jp, 'auto-asc').map((t) => t.name)).toEqual(['あさ', 'かぜ', 'さくら'])
  })

  it('orders numbers naturally (tag2 before tag10)', () => {
    const nums = [tag('tag10', 0), tag('tag2', 1), tag('tag1', 2)]
    expect(sortTagsByMode(nums, 'auto-asc').map((t) => t.name)).toEqual(['tag1', 'tag2', 'tag10'])
  })

  it('does not mutate the input array', () => {
    const input = [tag('b', 0), tag('a', 1)]
    sortTagsByMode(input, 'auto-asc')
    expect(input.map((t) => t.name)).toEqual(['b', 'a'])
  })
})

describe('nextTagOrderMode', () => {
  it('manual → auto-asc (first press sorts ascending)', () => {
    expect(nextTagOrderMode('manual')).toBe('auto-asc')
  })
  it('auto-asc → auto-desc', () => {
    expect(nextTagOrderMode('auto-asc')).toBe('auto-desc')
  })
  it('auto-desc → auto-asc', () => {
    expect(nextTagOrderMode('auto-desc')).toBe('auto-asc')
  })
})

describe('DEFAULT_TAG_ORDER_MODE', () => {
  it('is alphabetical ascending', () => {
    expect(DEFAULT_TAG_ORDER_MODE).toBe('auto-asc')
  })
})
