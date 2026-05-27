// functions/s/_template.test.ts
import { describe, it, expect } from 'vitest'
import { renderShareNotFoundHTML, type Theme404Variant } from './_template'

const dummyTheme: Theme404Variant = {
  name: 'dummy',
  bodyHTML: '<p class="dummy-body">DUMMY BODY</p>',
  inlineCSS: '.dummy-body { color: lime; }',
  inlineScript: 'window.__DUMMY_LOADED__ = true;',
}

describe('renderShareNotFoundHTML', () => {
  it('returns an HTML5 document with the dummy theme content inlined', () => {
    const html = renderShareNotFoundHTML({ theme: dummyTheme })
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toContain('<p class="dummy-body">DUMMY BODY</p>')
    expect(html).toContain('.dummy-body { color: lime; }')
    expect(html).toContain('window.__DUMMY_LOADED__ = true;')
  })

  it('marks the page as noindex (= expired pages should not be crawled)', () => {
    const html = renderShareNotFoundHTML({ theme: dummyTheme })
    expect(html).toContain('<meta name="robots" content="noindex">')
  })

  it('uses an "Expired share" title and og:description that invites the visitor to create their own', () => {
    const html = renderShareNotFoundHTML({ theme: dummyTheme })
    expect(html).toContain('<title>Expired share')
    expect(html).toMatch(/og:description[^>]*Make your own/i)
  })

  it('records the theme name on the body element for debugging / future targeting', () => {
    const html = renderShareNotFoundHTML({ theme: dummyTheme })
    expect(html).toMatch(/<body[^>]*data-theme="dummy"/)
  })
})
