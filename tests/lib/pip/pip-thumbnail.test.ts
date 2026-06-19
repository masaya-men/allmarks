import { describe, it, expect } from 'vitest'
import { pipDisplayThumbnail } from '@/lib/pip/pip-thumbnail'
import { pickPlaceholderImage } from '@/lib/board/placeholder-image'

describe('pipDisplayThumbnail', () => {
  it('returns the real thumbnail when present', () => {
    expect(pipDisplayThumbnail('https://cdn/x.jpg', 'https://example.com')).toBe('https://cdn/x.jpg')
  })

  it('falls back to the board placeholder image when the thumbnail is empty', () => {
    const url = 'https://www.jpo.go.jp/support/startup/shohyo_search.html'
    const expected = pickPlaceholderImage(url)?.url ?? ''
    expect(expected).not.toBe('')
    expect(pipDisplayThumbnail('', url)).toBe(expected)
  })

  it('is deterministic — same URL always picks the same placeholder', () => {
    const url = 'https://example.com/no-image'
    expect(pipDisplayThumbnail('', url)).toBe(pipDisplayThumbnail('', url))
  })
})
