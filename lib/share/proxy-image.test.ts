import { describe, it, expect } from 'vitest'
import { proxyImageUrl, isCrossOriginHttp, rewriteToProxy } from './proxy-image'

const ORIGIN = 'https://allmarks.app'

describe('proxyImageUrl', () => {
  it('wraps the original URL under /api/img?u= with encoding', () => {
    expect(proxyImageUrl('https://pbs.twimg.com/a.jpg?name=large')).toBe(
      '/api/img?u=https%3A%2F%2Fpbs.twimg.com%2Fa.jpg%3Fname%3Dlarge',
    )
  })

  it('encodes reserved characters so u survives as a single param', () => {
    const url = 'https://x.com/i/img?a=1&b=2'
    const proxied = proxyImageUrl(url)
    // The inner & must be encoded, so the proxy sees ONE u param.
    expect(proxied.includes('&b=2')).toBe(false)
    const parsed = new URL(proxied, ORIGIN)
    expect(parsed.searchParams.get('u')).toBe(url)
  })
})

describe('isCrossOriginHttp', () => {
  it('is true for a different-origin absolute http(s) URL', () => {
    expect(isCrossOriginHttp('https://pbs.twimg.com/a.jpg', ORIGIN)).toBe(true)
    expect(isCrossOriginHttp('http://animography.net/a.png', ORIGIN)).toBe(true)
  })

  it('is false for same-origin absolute URLs', () => {
    expect(isCrossOriginHttp('https://allmarks.app/paper/mat.png', ORIGIN)).toBe(false)
  })

  it('is false for data:, blob:, and relative URLs', () => {
    expect(isCrossOriginHttp('data:image/png;base64,AAAA', ORIGIN)).toBe(false)
    expect(isCrossOriginHttp('blob:https://allmarks.app/abc', ORIGIN)).toBe(false)
    expect(isCrossOriginHttp('/paper/mat.png', ORIGIN)).toBe(false)
    expect(isCrossOriginHttp('./thumb.jpg', ORIGIN)).toBe(false)
  })

  it('is false for unparseable garbage (fail safe = leave untouched)', () => {
    expect(isCrossOriginHttp('http://', ORIGIN)).toBe(false)
    expect(isCrossOriginHttp('', ORIGIN)).toBe(false)
  })
})

describe('rewriteToProxy', () => {
  it('rewrites only cross-origin http(s) srcs', () => {
    expect(rewriteToProxy('https://pbs.twimg.com/a.jpg', ORIGIN)).toBe(
      '/api/img?u=https%3A%2F%2Fpbs.twimg.com%2Fa.jpg',
    )
  })

  it('passes same-origin / data / relative through unchanged', () => {
    expect(rewriteToProxy('/paper/mat.png', ORIGIN)).toBe('/paper/mat.png')
    expect(rewriteToProxy('data:image/png;base64,AAAA', ORIGIN)).toBe('data:image/png;base64,AAAA')
    expect(rewriteToProxy('https://allmarks.app/x.png', ORIGIN)).toBe('https://allmarks.app/x.png')
  })
})
