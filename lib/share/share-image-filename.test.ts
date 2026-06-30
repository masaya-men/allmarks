import { describe, it, expect } from 'vitest'
import { shareImageFilename } from './share-image-filename'

describe('shareImageFilename', () => {
  it('uses .jpg for JPEG data URLs', () => {
    expect(shareImageFilename('aB3x9', 'data:image/jpeg;base64,AAAA')).toBe('allmarks-aB3x9.jpg')
  })

  it('uses .webp for WebP data URLs (legacy canvas fallback)', () => {
    expect(shareImageFilename('aB3x9', 'data:image/webp;base64,AAAA')).toBe('allmarks-aB3x9.webp')
  })

  it('uses .png for PNG data URLs', () => {
    expect(shareImageFilename('id1', 'data:image/png;base64,AAAA')).toBe('allmarks-id1.png')
  })

  it('defaults to .jpg for an unrecognised prefix', () => {
    expect(shareImageFilename('id1', 'blob:whatever')).toBe('allmarks-id1.jpg')
  })

  it('sanitises unsafe characters in the id', () => {
    expect(shareImageFilename('a/b c.d', 'data:image/jpeg;base64,AAAA')).toBe('allmarks-a-b-c-d.jpg')
  })

  it('falls back to "board" when the id sanitises to empty', () => {
    expect(shareImageFilename('///', 'data:image/jpeg;base64,AAAA')).toBe('allmarks-board.jpg')
  })
})
