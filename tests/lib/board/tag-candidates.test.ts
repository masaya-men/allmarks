import { describe, it, expect } from 'vitest'
import { extractCandidatesFromBookmark, scoreSimilarBookmarks } from '@/lib/board/tag-candidates'
import type { BookmarkRecord } from '@/lib/storage/indexeddb'

function mk(id: string, fields: Partial<BookmarkRecord>): BookmarkRecord {
  return {
    id, url: 'https://example.com', title: '', description: '', thumbnail: '',
    favicon: '', siteName: '', type: 'website', savedAt: '2026-01-01T00:00:00.000Z',
    ogpStatus: 'fetched', tags: [], ...fields,
  } as BookmarkRecord
}

describe('extractCandidatesFromBookmark', () => {
  it('Twitter ハッシュタグを抽出', () => {
    const b = mk('b1', { title: '#アート と #デザイン の話', type: 'tweet' })
    expect(extractCandidatesFromBookmark(b)).toEqual(['アート', 'デザイン'])
  })

  it('YouTube は siteName + チャンネル名候補', () => {
    const b = mk('b1', { siteName: 'YouTube', title: 'Lo-Fi Chill Music by ChillBeats', type: 'youtube' })
    const c = extractCandidatesFromBookmark(b)
    expect(c).toContain('YouTube')
  })

  it('OGP siteName を最初に出す', () => {
    const b = mk('b1', { siteName: 'Vimeo', type: 'website' })
    const c = extractCandidatesFromBookmark(b)
    expect(c[0]).toBe('Vimeo')
  })

  it('重複は dedupe', () => {
    const b = mk('b1', { title: '#test #test', siteName: 'test', type: 'tweet' })
    const c = extractCandidatesFromBookmark(b)
    expect(new Set(c).size).toBe(c.length)
  })

  it('siteName 無し + ハッシュタグ無し = 空配列', () => {
    const b = mk('b1', { title: '普通のテキスト', type: 'website' })
    expect(extractCandidatesFromBookmark(b)).toEqual([])
  })
})

describe('scoreSimilarBookmarks', () => {
  it('同ドメインで頻出するタグを上位に', () => {
    const target = mk('b1', { url: 'https://example.com/x' })
    const corpus = [
      mk('a1', { url: 'https://example.com/a', tags: ['アート', 'デザイン'] }),
      mk('a2', { url: 'https://example.com/b', tags: ['アート'] }),
      mk('a3', { url: 'https://other.com/c', tags: ['全然関係ない'] }),
    ]
    const scored = scoreSimilarBookmarks(target, corpus)
    expect(scored[0]).toBe('アート')
  })

  it('target 自身は除外', () => {
    const target = mk('b1', { url: 'https://example.com/x', tags: ['x'] })
    const scored = scoreSimilarBookmarks(target, [target])
    expect(scored).toEqual([])
  })
})
