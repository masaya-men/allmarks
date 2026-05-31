import { describe, it, expect } from 'vitest'
import { shareCardToBoardItem } from './share-card-to-board-item'
import type { ShareCardV2 } from './types-v2'

const card: ShareCardV2 = { u: 'https://x.com/a/status/1', t: 'Title', d: 'Desc', th: 'thumb.jpg', ty: 'tweet', cw: 320, a: 1.5, tg: ['t1'] }

describe('shareCardToBoardItem', () => {
  it('maps fields onto a valid BoardItem', () => {
    const it0 = shareCardToBoardItem(card, 3)
    expect(it0.bookmarkId).toBe('https://x.com/a/status/1')
    expect(it0.cardId).toBe('https://x.com/a/status/1')
    expect(it0.url).toBe('https://x.com/a/status/1')
    expect(it0.title).toBe('Title')
    expect(it0.description).toBe('Desc')
    expect(it0.thumbnail).toBe('thumb.jpg')
    expect(it0.aspectRatio).toBe(1.5)
    expect(it0.cardWidth).toBe(320)
    expect(it0.customCardWidth).toBe(true)
    expect(it0.gridIndex).toBe(3)
    expect(it0.orderIndex).toBe(3)
    expect(it0.isRead).toBe(false)
    expect(it0.isDeleted).toBe(false)
    expect(it0.tags).toEqual([])
    expect(it0.displayMode).toBeNull()
  })
})
