import { describe, it, expect } from 'vitest'
import { pickPlaceholderImage, placeholderCount } from './placeholder-image'

describe('pickPlaceholderImage', () => {
  it('returns a path string when placeholders are registered', () => {
    expect(placeholderCount()).toBeGreaterThan(0)
    const path = pickPlaceholderImage('https://x.com/foo/status/1')
    expect(path).toBeTruthy()
    expect(path).toMatch(/^\/placeholders\//)
  })

  it('returns the same path for the same URL across calls (deterministic)', () => {
    const url = 'https://x.com/foo/status/42'
    const a = pickPlaceholderImage(url)
    const b = pickPlaceholderImage(url)
    expect(a).toBe(b)
  })

  it('different URLs may map to different slots', () => {
    // With only 1 slot registered today they collide, but the hashing is
    // distinct so this test mostly guards that the function doesn't crash
    // on varied inputs.
    const urls = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(c => `https://x.com/foo/status/${c}`)
    const paths = urls.map(pickPlaceholderImage)
    expect(paths.every(p => p !== null)).toBe(true)
  })
})
