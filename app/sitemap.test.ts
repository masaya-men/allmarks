import { describe, it, expect } from 'vitest'
import sitemap from './sitemap'
import { SITE_URL } from '@/lib/constants'

describe('sitemap', () => {
  it('15言語ぶんのトップLP URL を含む', () => {
    const urls = sitemap().map((e) => e.url)
    expect(urls).toContain(`${SITE_URL}/`)
    expect(urls).toContain(`${SITE_URL}/ja`)
    expect(urls).toContain(`${SITE_URL}/zh`)
    expect(urls).toContain(`${SITE_URL}/ar`)
  })
  it('既存の /board /faq も残っている', () => {
    const urls = sitemap().map((e) => e.url)
    expect(urls).toContain(`${SITE_URL}/board`)
    expect(urls).toContain(`${SITE_URL}/faq`)
  })
})
