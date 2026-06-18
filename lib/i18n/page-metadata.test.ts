import { describe, it, expect } from 'vitest'
import { pageMetadata } from './page-metadata'

describe('pageMetadata', () => {
  it('canonical は自分自身(ja/about → /ja/about)', () => {
    const m = pageMetadata('ja', 'about', 'about')
    expect(m.alternates?.canonical).toBe('/ja/about')
  })
  it('canonical は英語フラット(en/about → /about)', () => {
    const m = pageMetadata('en', 'about', 'about')
    expect(m.alternates?.canonical).toBe('/about')
  })
  it('hreflang は16エントリ', () => {
    const m = pageMetadata('en', 'about', 'about')
    expect(Object.keys(m.alternates?.languages ?? {})).toHaveLength(16)
  })
  it('title は AllMarks を含む', () => {
    const m = pageMetadata('en', 'about', 'about')
    const title = (m.title as { absolute: string }).absolute
    expect(title).toContain('AllMarks')
  })
})
