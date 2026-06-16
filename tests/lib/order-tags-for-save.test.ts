// tests/lib/order-tags-for-save.test.ts
import { describe, it, expect } from 'vitest'
import { orderTagsForSave } from '@/lib/tagger/order-tags-for-save'
import type { BookmarkRecord, TagRecord } from '@/lib/storage/indexeddb'

function bm(partial: Partial<BookmarkRecord>): BookmarkRecord {
  return { id: 'x', url: 'https://example.com/a', title: '', tags: [], ...partial } as BookmarkRecord
}
function tag(id: string, name: string): TagRecord {
  return { id, name, color: '#28F100', order: 0, createdAt: 0 } as TagRecord
}

describe('orderTagsForSave', () => {
  it('ranks tags used by same-domain bookmarks first, keeps the rest after', () => {
    const target = bm({ id: 't', url: 'https://example.com/new', tags: [] })
    const corpus: BookmarkRecord[] = [
      bm({ id: 'a', url: 'https://example.com/1', tags: ['cook'] }),
      bm({ id: 'b', url: 'https://example.com/2', tags: ['cook'] }),
      bm({ id: 'c', url: 'https://other.com/9', tags: ['music'] }),
    ]
    const allTags = [tag('cook', 'cooking'), tag('music', 'music'), tag('zzz', 'misc')]
    const out = orderTagsForSave(target, corpus, allTags)
    expect(out.map((t) => t.id)).toEqual(['cook', 'music', 'zzz'])
    expect(out[0]).toEqual({ id: 'cook', name: 'cooking', color: '#28F100' })
  })

  it('still includes the bookmark’s current tags (so the strip can mark them ✓)', () => {
    const target = bm({ id: 't', url: 'https://example.com/new', tags: ['cook'] })
    const corpus: BookmarkRecord[] = [bm({ id: 'a', url: 'https://example.com/1', tags: ['music'] })]
    const allTags = [tag('cook', 'cooking'), tag('music', 'music')]
    const ids = orderTagsForSave(target, corpus, allTags).map((t) => t.id)
    expect(ids).toContain('cook')
    expect(ids).toContain('music')
  })

  it('returns [] when there are no tags', () => {
    expect(orderTagsForSave(bm({ id: 't' }), [], [])).toEqual([])
  })
})
