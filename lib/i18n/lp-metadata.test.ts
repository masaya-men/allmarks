import { describe, it, expect } from 'vitest'
import { lpMetadata } from './lp-metadata'

describe('lpMetadata', () => {
  it('英語: canonical=/ , x-default=/ , ja alternate=/ja', () => {
    const m = lpMetadata('en')
    expect(m.alternates?.canonical).toBe('/')
    const langs = m.alternates?.languages as Record<string, string>
    expect(langs['x-default']).toBe('/')
    expect(langs.ja).toBe('/ja')
  })
  it('日本語: canonical=/ja , description が日本語(英語と異なる)', () => {
    const m = lpMetadata('ja')
    expect(m.alternates?.canonical).toBe('/ja')
    expect(m.description).not.toBe(lpMetadata('en').description)
    expect(typeof m.description).toBe('string')
  })
  it('英語タイトルは AllMarks — Bookmark × Collage を維持', () => {
    const m = lpMetadata('en')
    expect(m.title).toEqual({ absolute: 'AllMarks — Bookmark × Collage' })
  })
  it('日本語タイトルは AllMarks — {日本語見出し}(英語と異なる・og と一致)', () => {
    const m = lpMetadata('ja')
    const t = m.title as { absolute: string }
    expect(t.absolute.startsWith('AllMarks — ')).toBe(true)
    expect(t.absolute).not.toBe('AllMarks — Bookmark × Collage')
    expect((m.openGraph as { title?: string }).title).toBe(t.absolute)
  })
})
