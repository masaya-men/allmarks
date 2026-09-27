import { describe, it, expect } from 'vitest'
import { makeCard, ACCENTS, DEFAULT_ACCENT } from './art'

describe('makeCard', () => {
  it('builds a tweet card with the AllMarks author and the given text (as text, not HTML)', () => {
    const el = makeCard({ tweet: 1, a: 1 }, { amb: false, tweetText: 'a <b>x</b>\n\nb' })
    expect(el.classList.contains('card')).toBe(true)
    expect(el.classList.contains('tcard')).toBe(true)
    expect(el.querySelector('.tw-name')?.textContent).toBe('AllMarks')
    expect(el.querySelector('.tw-av')?.textContent).toBe('A')
    expect(el.querySelector('.tw-body p')?.textContent).toBe('a <b>x</b>\n\nb')
    expect(el.querySelector('.tw-body b')).toBeNull()
  })
  it('builds an art card that carries its accent colour', () => {
    const el = makeCard({ art: 'grid', a: 0.8 }, { amb: false })
    const art = el.querySelector<HTMLElement>('.art')
    expect(art).not.toBeNull()
    expect(art?.style.getPropertyValue('--acc')).toBe(ACCENTS[DEFAULT_ACCENT.grid])
  })
})
