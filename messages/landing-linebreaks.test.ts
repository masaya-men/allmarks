import { describe, it, expect } from 'vitest'
import ar from './ar.json'
import de from './de.json'
import en from './en.json'
import es from './es.json'
import fr from './fr.json'
import itMessages from './it.json'
import ja from './ja.json'
import ko from './ko.json'
import nl from './nl.json'
import pt from './pt.json'
import ru from './ru.json'
import th from './th.json'
import tr from './tr.json'
import vi from './vi.json'
import zh from './zh.json'

const FILES: Record<string, unknown> = { ar, de, en, es, fr, it: itMessages, ja, ko, nl, pt, ru, th, tr, vi, zh }

function get(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (typeof o === 'object' && o !== null ? (o as Record<string, unknown>)[k] : undefined), obj)
}

const HEADLINES = ['landing.hero.headline', 'landing.problem.headline', 'landing.cta.headline']
const NEW_KEYS = [
  'landing.demo.pasteHint', 'landing.demo.saved', 'landing.demo.inBrowser', 'landing.demo.noSignup',
  'landing.demo.saveImage', 'landing.demo.copyLink', 'landing.demo.copied', 'landing.problem.chipList',
  'landing.demo.tweet1', 'landing.demo.tweet2', 'landing.demo.tweet3',
]

describe.each(Object.keys(FILES))('landing copy (%s)', (lc) => {
  const m = FILES[lc]
  it.each(HEADLINES)('%s has exactly one line break and reads as one line without it', (key) => {
    const v = get(m, key)
    expect(typeof v).toBe('string')
    const s = v as string
    expect(s.split('\n').length).toBe(2)
    const joined = s.replace(/\n/g, '')
    expect(joined).toBe(joined.trim())
    expect(joined).not.toMatch(/ {2}/)
    for (const line of s.split('\n')) expect(line.trim().length).toBeGreaterThan(0)
  })
  it.each(NEW_KEYS)('%s is a non-empty string', (key) => {
    const v = get(m, key)
    expect(typeof v).toBe('string')
    expect((v as string).trim().length).toBeGreaterThan(0)
  })
  it.each(['landing.demo.tweet1', 'landing.demo.tweet2', 'landing.demo.tweet3'])('%s has two paragraphs', (key) => {
    const s = get(m, key) as string
    expect(s.split('\n\n').length).toBe(2)
  })
  it('demo labels carry no ✓ / ↓ marks (the UI adds them)', () => {
    for (const key of ['landing.demo.saved', 'landing.demo.copied', 'landing.demo.saveImage']) {
      expect(get(m, key) as string).not.toMatch(/[✓↓]/)
    }
  })
})

// ja / zh / th don't put spaces between words, so the approved source text has
// no space anywhere in these headlines. The line break must be inserted at a
// bare character boundary — adding a space next to it would silently change
// the approved copy (removing \n must reproduce the exact approved string).
const NO_SPACE_LOCALES = ['ja', 'zh', 'th']

describe.each(NO_SPACE_LOCALES)('no-space script headlines (%s) add no space at the break', (lc) => {
  const m = FILES[lc]
  it.each(HEADLINES)('%s has no space adjacent to the line break', (key) => {
    const s = get(m, key) as string
    expect(s).not.toMatch(/ \n|\n /)
  })
})
