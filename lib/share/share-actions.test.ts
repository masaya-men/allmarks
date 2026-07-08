import { describe, it, expect, vi } from 'vitest'
import { buildTweetIntentUrl, dataUrlToFile, canWebShareFiles } from './share-actions'

describe('buildTweetIntentUrl', () => {
  it('encodes the share url', () => {
    const u = buildTweetIntentUrl('https://allmarks.app/s/k3p9xv')
    expect(u).toContain('https://twitter.com/intent/tweet?')
    expect(u).toContain('url=https%3A%2F%2Fallmarks.app%2Fs%2Fk3p9xv')
    expect(u).not.toContain('text=')
  })
  it('includes text when provided', () => {
    const u = buildTweetIntentUrl('https://allmarks.app/s/k3p9xv', 'my collage')
    expect(u).toContain('text=my+collage')
  })
})

describe('dataUrlToFile', () => {
  it('decodes a base64 jpeg data url into an image/jpeg File', () => {
    // "AAAA" base64 → 3 bytes
    const f = dataUrlToFile('data:image/jpeg;base64,AAAA', 'collage.jpg')
    expect(f).not.toBeNull()
    expect(f?.type).toBe('image/jpeg')
    expect(f?.name).toBe('collage.jpg')
    expect(f?.size).toBe(3)
  })
  it('returns null for a non-data-url string', () => {
    expect(dataUrlToFile('https://example.com/x.jpg', 'x.jpg')).toBeNull()
  })
})

describe('canWebShareFiles', () => {
  const file = new File([new Uint8Array([1])], 'x.jpg', { type: 'image/jpeg' })
  it('false when navigator has no canShare', () => {
    expect(canWebShareFiles({} as unknown as Pick<Navigator, 'canShare'>, file)).toBe(false)
    expect(canWebShareFiles(undefined, file)).toBe(false)
  })
  it('delegates to navigator.canShare({ files })', () => {
    const canShare = vi.fn().mockReturnValue(true)
    expect(canWebShareFiles({ canShare }, file)).toBe(true)
    expect(canShare).toHaveBeenCalledWith({ files: [file] })
  })
  it('false when canShare throws', () => {
    const canShare = vi.fn().mockImplementation(() => { throw new Error('nope') })
    expect(canWebShareFiles({ canShare }, file)).toBe(false)
  })
})
