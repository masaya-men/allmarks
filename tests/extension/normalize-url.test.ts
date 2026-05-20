import { describe, it, expect } from 'vitest'
import { normalizeUrl } from '../../extension/lib/normalize-url.js'

describe('normalizeUrl — general', () => {
  it('returns the input unchanged for empty/null/undefined', () => {
    expect(normalizeUrl('')).toBe('')
    expect(normalizeUrl(null)).toBe(null)
    expect(normalizeUrl(undefined)).toBe(undefined)
  })

  it('returns the input unchanged for unparseable URLs', () => {
    expect(normalizeUrl('not a url')).toBe('not a url')
  })

  it('leaves non-http(s) protocols alone', () => {
    expect(normalizeUrl('chrome://extensions/')).toBe('chrome://extensions/')
    expect(normalizeUrl('file:///etc/hosts')).toBe('file:///etc/hosts')
  })

  it('is idempotent — normalizing twice yields the same result', () => {
    const u = 'https://www.youtube.com/watch?v=abc123&list=PL1&t=42s&utm_source=x'
    expect(normalizeUrl(normalizeUrl(u))).toBe(normalizeUrl(u))
  })

  it('lowercases the hostname', () => {
    expect(normalizeUrl('https://Example.COM/path')).toBe('https://example.com/path')
  })

  it('strips default ports', () => {
    expect(normalizeUrl('https://example.com:443/path')).toBe('https://example.com/path')
    expect(normalizeUrl('http://example.com:80/path')).toBe('http://example.com/path')
  })

  it('keeps the hash fragment', () => {
    expect(normalizeUrl('https://github.com/foo/bar#L42')).toBe('https://github.com/foo/bar#L42')
  })

  it('removes trailing slash from non-root paths', () => {
    expect(normalizeUrl('https://example.com/foo/')).toBe('https://example.com/foo')
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/')
  })
})

describe('normalizeUrl — global tracking params', () => {
  it('strips utm_* params', () => {
    expect(normalizeUrl('https://example.com/post?utm_source=newsletter&utm_medium=email&utm_campaign=fall2025'))
      .toBe('https://example.com/post')
  })

  it('strips mc_* params (Mailchimp)', () => {
    expect(normalizeUrl('https://example.com/post?mc_eid=abc&mc_cid=123'))
      .toBe('https://example.com/post')
  })

  it('strips _ga and _gl analytics params', () => {
    expect(normalizeUrl('https://example.com/post?_ga=GA1.2.123&_gl=1.2.3'))
      .toBe('https://example.com/post')
  })

  it('strips fbclid / gclid / msclkid / yclid', () => {
    expect(normalizeUrl('https://example.com/post?fbclid=abc&gclid=def&msclkid=ghi&yclid=jkl'))
      .toBe('https://example.com/post')
  })

  it('strips igshid (Instagram share id)', () => {
    expect(normalizeUrl('https://example.com/post?igshid=xyz'))
      .toBe('https://example.com/post')
  })

  it('keeps non-tracking params alongside stripped ones', () => {
    expect(normalizeUrl('https://example.com/post?id=42&utm_source=x&category=news'))
      .toBe('https://example.com/post?id=42&category=news')
  })
})

describe('normalizeUrl — YouTube', () => {
  it('keeps the v= param, strips list/index/t/pp/si', () => {
    expect(normalizeUrl('https://www.youtube.com/watch?v=abc123&list=PLxyz&index=5&t=42s&pp=quality'))
      .toBe('https://www.youtube.com/watch?v=abc123')
  })

  it('handles m.youtube.com the same way', () => {
    expect(normalizeUrl('https://m.youtube.com/watch?v=abc123&list=PL'))
      .toBe('https://m.youtube.com/watch?v=abc123')
  })

  it('strips feature / ab_channel / start_radio', () => {
    expect(normalizeUrl('https://www.youtube.com/watch?v=abc123&feature=youtu.be&ab_channel=Creator&start_radio=1'))
      .toBe('https://www.youtube.com/watch?v=abc123')
  })

  it('strips utm_* even on youtube.com (global rule still applies)', () => {
    expect(normalizeUrl('https://www.youtube.com/watch?v=abc123&utm_source=share'))
      .toBe('https://www.youtube.com/watch?v=abc123')
  })

  it('matches the form youtube.js writes to the mirror', () => {
    // youtube.js builds: 'https://www.youtube.com/watch?v=' + v
    const saved = 'https://www.youtube.com/watch?v=abc123'
    // user revisits from a playlist:
    const visited = 'https://www.youtube.com/watch?v=abc123&list=PLxyz&index=5'
    expect(normalizeUrl(saved)).toBe(normalizeUrl(visited))
  })
})

describe('normalizeUrl — X / Twitter', () => {
  it('strips ref_src / s / t / cn from x.com', () => {
    expect(normalizeUrl('https://x.com/handle/status/123?ref_src=twsrc%5Etfw&s=20&t=abc'))
      .toBe('https://x.com/handle/status/123')
  })

  it('strips ref_src on twitter.com legacy domain', () => {
    expect(normalizeUrl('https://twitter.com/handle/status/123?ref_src=twsrc'))
      .toBe('https://twitter.com/handle/status/123')
  })

  it('strips ref_src on mobile.x.com', () => {
    expect(normalizeUrl('https://mobile.x.com/handle/status/123?ref_src=foo'))
      .toBe('https://mobile.x.com/handle/status/123')
  })

  it('matches the form twitter.js writes to the mirror', () => {
    // twitter.js builds the path-relative URL via new URL(href, location.origin).
    const saved = 'https://x.com/handle/status/123'
    const visited = 'https://x.com/handle/status/123?ref_src=twsrc&t=abc'
    expect(normalizeUrl(saved)).toBe(normalizeUrl(visited))
  })
})

describe('normalizeUrl — preserves content-identifying params', () => {
  it('keeps query params that are not on the strip list', () => {
    expect(normalizeUrl('https://example.com/search?q=hello+world&category=news'))
      .toBe('https://example.com/search?q=hello+world&category=news')
  })

  it('does not strip per-host params on unrelated hosts', () => {
    // `list` is only stripped on youtube.com — on a random site it could be content.
    expect(normalizeUrl('https://news.example.com/items?list=popular'))
      .toBe('https://news.example.com/items?list=popular')
  })

  it('does not strip `t` on unrelated hosts (only on x.com / youtube.com)', () => {
    expect(normalizeUrl('https://docs.example.com/article?t=section-2'))
      .toBe('https://docs.example.com/article?t=section-2')
  })
})
