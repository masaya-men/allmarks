// lib/share/board-to-share.test.ts
import { describe, it, expect } from 'vitest'
import { buildShareDataFromBoard } from './board-to-share'
import { SHARE_SCHEMA_VERSION_V2 } from './types-v2'

const sampleItems = [
  {
    bookmarkId: 'b1',
    url: 'https://example.com',
    title: 'Title 1',
    description: 'Desc',
    thumbnail: 'https://cdn.example.com/t1.jpg',
    aspectRatio: 1.5,
    tags: ['t-music'],
    cardWidth: 240,
  },
]

const sampleTags = [
  { id: 't-music', name: 'music', color: '#28F100' },
  { id: 't-design', name: 'design', color: '#FF8800' },
]

describe('buildShareDataFromBoard', () => {
  it('produces a ShareDataV2 from board items', () => {
    const data = buildShareDataFromBoard({
      items: sampleItems,
      tags: sampleTags,
      filter: null,
      now: 1735000000000,
    })
    expect(data.v).toBe(SHARE_SCHEMA_VERSION_V2)
    expect(data.cards.length).toBe(1)
    expect(data.cards[0].u).toBe('https://example.com')
    expect(data.cards[0].cw).toBe(240)
    expect(data.cards[0].a).toBe(1.5)
    expect(data.cards[0].tg).toEqual(['t-music'])
    expect(data.tags).toEqual({ 't-music': { n: 'music', c: '#28F100' } })
    expect(data.createdAt).toBe(1735000000000)
  })

  it('only includes tags actually referenced by cards', () => {
    const data = buildShareDataFromBoard({
      items: sampleItems,
      tags: sampleTags,
      filter: null,
      now: 1735000000000,
    })
    expect(Object.keys(data.tags ?? {})).toEqual(['t-music'])
  })

  it('includes filter context when provided', () => {
    const data = buildShareDataFromBoard({
      items: sampleItems,
      tags: sampleTags,
      filter: { mode: 'or', tagIds: ['t-music', 't-design'] },
      now: 1735000000000,
    })
    expect(data.filter).toEqual({ mode: 'or', tagIds: ['t-music', 't-design'] })
  })

  it('truncates titles longer than MAX_TITLE', () => {
    const data = buildShareDataFromBoard({
      items: [{ ...sampleItems[0], title: 'x'.repeat(600) }],
      tags: [],
      filter: null,
      now: 1735000000000,
    })
    expect(data.cards[0].t.length).toBe(500)
  })

  it('caps cards at MAX_CARDS', () => {
    const many = Array.from({ length: 200 }, (_, i) => ({
      ...sampleItems[0],
      bookmarkId: `b${i}`,
      url: `https://example.com/${i}`,
    }))
    const data = buildShareDataFromBoard({ items: many, tags: [], filter: null, now: 1735000000000 })
    expect(data.cards.length).toBe(100)
  })
})
