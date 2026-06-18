import { describe, it, expect } from 'vitest'
import sitemap from './sitemap'
import { SITE_URL } from '@/lib/constants'

describe('sitemap', () => {
  const entries = sitemap()
  const urls = entries.map((e) => e.url)

  it('15言語ぶんのトップLP URL を含む', () => {
    expect(urls).toContain(`${SITE_URL}/`)
    expect(urls).toContain(`${SITE_URL}/ja`)
    expect(urls).toContain(`${SITE_URL}/zh`)
    expect(urls).toContain(`${SITE_URL}/ar`)
  })
  it('既存の /board /faq も残っている', () => {
    expect(urls).toContain(`${SITE_URL}/board`)
    expect(urls).toContain(`${SITE_URL}/faq`)
  })
  it('英語 About を含む', () => {
    expect(urls).toContain(`${SITE_URL}/about`)
  })
  it('日本語 About を含む', () => {
    expect(urls).toContain(`${SITE_URL}/ja/about`)
  })
  it('About は15言語ぶん存在する', () => {
    const aboutUrls = urls.filter((u) => u.endsWith('/about'))
    expect(aboutUrls).toHaveLength(15)
  })
})

describe('sitemap 集客4ページ', () => {
  const urls = sitemap().map((e) => e.url)
  for (const page of ['features', 'guide', 'faq', 'extension'] as const) {
    it(`${page} は英語フラットを含む`, () => {
      expect(urls).toContain(`${SITE_URL}/${page}`)
    })
    it(`${page} は日本語版を含む`, () => {
      expect(urls).toContain(`${SITE_URL}/ja/${page}`)
    })
    it(`${page} は15言語ぶん存在する`, () => {
      expect(urls.filter((u) => u.endsWith(`/${page}`))).toHaveLength(15)
    })
  }
})
