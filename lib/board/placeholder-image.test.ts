import { describe, it, expect } from 'vitest'
import { pickPlaceholderImage, placeholderCount } from './placeholder-image'

describe('pickPlaceholderImage', () => {
  it('returns a {url, aspect} object when placeholders are registered', () => {
    expect(placeholderCount()).toBeGreaterThan(0)
    const result = pickPlaceholderImage('https://x.com/foo/status/1')
    expect(result).toBeTruthy()
    expect(result?.url).toMatch(/^\/placeholders\//)
    expect(typeof result?.aspect).toBe('number')
    expect(result?.aspect).toBeGreaterThan(0)
  })

  it('serves the brand-generated SVG art set (6 styles under /placeholders/art/)', () => {
    expect(placeholderCount()).toBe(6)
    const result = pickPlaceholderImage('https://example.com/article')
    // file URL (not a data: URI) → safe in CSS url(), <img src> and canvas Image
    expect(result?.url).toMatch(/^\/placeholders\/art\/default\/[a-z]+\.svg$/)
  })

  it('only ever returns URLs from the known generated-art set', () => {
    const known = new Set(
      ['waveform', 'aurora', 'oscillo', 'grain', 'ripple', 'dots'].map(
        (s) => `/placeholders/art/default/${s}.svg`,
      ),
    )
    for (let i = 0; i < 50; i++) {
      const url = pickPlaceholderImage(`https://site${i}.test/path/${i}`)?.url
      expect(url).toBeTruthy()
      expect(known.has(url as string)).toBe(true)
    }
  })

  it('returns the same image for the same URL across calls (deterministic)', () => {
    const url = 'https://x.com/foo/status/42'
    const a = pickPlaceholderImage(url)
    const b = pickPlaceholderImage(url)
    expect(a?.url).toBe(b?.url)
    expect(a?.aspect).toBe(b?.aspect)
  })

  it('distributes varied URLs across multiple slots (= visual variety on the board)', () => {
    // With 4 slots, 12 distinct URLs should hit at least 2 different ones.
    const urls = Array.from({ length: 12 }, (_, i) => `https://x.com/foo/status/${i}`)
    const slots = new Set(urls.map((u) => pickPlaceholderImage(u)?.url))
    expect(slots.size).toBeGreaterThan(1)
  })
})
