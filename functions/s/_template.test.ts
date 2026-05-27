// functions/s/_template.test.ts
import { describe, it, expect } from 'vitest'
import { renderShareHTML, renderShareNotFoundHTML, type Theme404Variant } from './_template'

const dummyTheme: Theme404Variant = {
  name: 'dummy',
  bodyHTML: '<p class="dummy-body">DUMMY BODY</p>',
  inlineCSS: '.dummy-body { color: lime; }',
  inlineScript: 'window.__DUMMY_LOADED__ = true;',
}

const baseInput = {
  id: 'k3p9xv',
  cardCount: 12,
  scripts: ['/_next/static/chunks/webpack-abc.js', '/_next/static/chunks/main-app-def.js'],
  stylesheets: ['/_next/static/css/styles-xyz.css'],
  baseUrl: 'https://booklage.pages.dev',
} as const

describe('renderShareHTML', () => {
  it('returns an HTML5 document string', () => {
    const html = renderShareHTML({ ...baseInput, page: 'landing' })
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toMatch(/<html[^>]*lang="en"/)
    expect(html).toContain('</html>')
  })

  it('embeds per-id og:image pointing to the share OG endpoint', () => {
    const html = renderShareHTML({ ...baseInput, page: 'landing' })
    expect(html).toContain('<meta property="og:image" content="https://booklage.pages.dev/api/share/k3p9xv/og.webp">')
    expect(html).toContain('<meta name="twitter:image" content="https://booklage.pages.dev/api/share/k3p9xv/og.webp">')
  })

  it('embeds og:url for the landing page', () => {
    const html = renderShareHTML({ ...baseInput, page: 'landing' })
    expect(html).toContain('<meta property="og:url" content="https://booklage.pages.dev/s/k3p9xv">')
  })

  it('embeds og:url for the triage page', () => {
    const html = renderShareHTML({ ...baseInput, page: 'triage' })
    expect(html).toContain('<meta property="og:url" content="https://booklage.pages.dev/s/k3p9xv/triage">')
  })

  it('renders the title and description with card count', () => {
    const html = renderShareHTML({ ...baseInput, page: 'landing' })
    expect(html).toContain('<title>Shared collection on AllMarks</title>')
    expect(html).toContain('og:description')
    expect(html).toMatch(/12 bookmarks/)
  })

  it('renders every script as a <script> tag', () => {
    const html = renderShareHTML({ ...baseInput, page: 'landing' })
    expect(html).toContain('<script src="/_next/static/chunks/webpack-abc.js"')
    expect(html).toContain('<script src="/_next/static/chunks/main-app-def.js"')
  })

  it('renders every stylesheet as a <link rel="stylesheet">', () => {
    const html = renderShareHTML({ ...baseInput, page: 'landing' })
    expect(html).toContain('<link rel="stylesheet" href="/_next/static/css/styles-xyz.css">')
  })

  it('injects window.__SHARE_ID__ and window.__SHARE_CARD_COUNT__ for the client', () => {
    const html = renderShareHTML({ ...baseInput, page: 'landing' })
    expect(html).toMatch(/window\.__SHARE_ID__\s*=\s*"k3p9xv"/)
    expect(html).toMatch(/window\.__SHARE_CARD_COUNT__\s*=\s*12/)
  })

  it('renders mount-point div for the React app', () => {
    const html = renderShareHTML({ ...baseInput, page: 'landing' })
    expect(html).toMatch(/<div id="__next">/)
  })

  it('handles an empty share (cardCount=0) without crashing', () => {
    const html = renderShareHTML({ ...baseInput, cardCount: 0, page: 'landing' })
    expect(html).toMatch(/0 bookmarks/)
    expect(html).toMatch(/window\.__SHARE_CARD_COUNT__\s*=\s*0/)
  })

  it('supports a different base URL (= future allmarks.app swap)', () => {
    const html = renderShareHTML({ ...baseInput, baseUrl: 'https://allmarks.app', page: 'landing' })
    expect(html).toContain('<meta property="og:url" content="https://allmarks.app/s/k3p9xv">')
    expect(html).toContain('<meta property="og:image" content="https://allmarks.app/api/share/k3p9xv/og.webp">')
  })
})

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
