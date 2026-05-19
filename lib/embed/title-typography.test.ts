import { describe, it, expect } from 'vitest'
import { pickTitleTypography } from './title-typography'

describe('pickTitleTypography (session 55 unified)', () => {
  const baseInput = { cardWidth: 280, cardHeight: 360 }

  it('always returns the unified typography regardless of title length', () => {
    const short = pickTitleTypography({ ...baseInput, title: 'short' })
    const medium = pickTitleTypography({ ...baseInput, title: 'a medium-length title with some characters' })
    const long = pickTitleTypography({ ...baseInput, title: 'a very long title '.repeat(20) })

    for (const r of [short, medium, long]) {
      expect(r.mode).toBe('editorial')
      expect(r.fontSize).toBe(18)
      expect(r.lineHeight).toBe(27)
      expect(r.maxLines).toBe(999)
    }
  })

  it('handles empty / emoji / CJK titles with the same unified values', () => {
    for (const title of ['', '🎨🌈✨', 'これは日本語のタイトルです']) {
      const r = pickTitleTypography({ ...baseInput, title })
      expect(r.fontSize).toBe(18)
      expect(r.mode).toBe('editorial')
    }
  })
})
