// scripts/build-share-manifest.test.ts
import { describe, it, expect } from 'vitest'
import { extractBundleManifest } from './build-share-manifest.mjs'

describe('extractBundleManifest', () => {
  it('extracts a single <script src> tag', () => {
    const html = '<html><body><script src="/a.js" defer></script></body></html>'
    const m = extractBundleManifest(html)
    expect(m.scripts).toEqual(['/a.js'])
  })

  it('extracts multiple <script src> tags in document order', () => {
    const html = `
      <html><head></head><body>
        <script src="/_next/static/chunks/webpack-abc.js" defer></script>
        <script src="/_next/static/chunks/framework-def.js" defer></script>
        <script src="/_next/static/chunks/main-app-ghi.js" defer></script>
      </body></html>
    `
    const m = extractBundleManifest(html)
    expect(m.scripts).toEqual([
      '/_next/static/chunks/webpack-abc.js',
      '/_next/static/chunks/framework-def.js',
      '/_next/static/chunks/main-app-ghi.js',
    ])
  })

  it('ignores inline <script> without src', () => {
    const html = '<script>console.log("hi")</script><script src="/a.js"></script>'
    const m = extractBundleManifest(html)
    expect(m.scripts).toEqual(['/a.js'])
  })

  it('extracts <link rel="stylesheet" href=...>', () => {
    const html = '<link rel="stylesheet" href="/_next/static/css/x.css">'
    const m = extractBundleManifest(html)
    expect(m.stylesheets).toEqual(['/_next/static/css/x.css'])
  })

  it('extracts <link> when href comes before rel', () => {
    const html = '<link href="/_next/static/css/x.css" rel="stylesheet">'
    const m = extractBundleManifest(html)
    expect(m.stylesheets).toEqual(['/_next/static/css/x.css'])
  })

  it('ignores <link rel="preload"> and other non-stylesheet links', () => {
    const html = `
      <link rel="preload" href="/font.woff2" as="font">
      <link rel="icon" href="/favicon.ico">
      <link rel="stylesheet" href="/styles.css">
    `
    const m = extractBundleManifest(html)
    expect(m.stylesheets).toEqual(['/styles.css'])
  })

  it('dedupes duplicate scripts and stylesheets', () => {
    const html = `
      <script src="/a.js"></script>
      <script src="/a.js"></script>
      <link rel="stylesheet" href="/x.css">
      <link rel="stylesheet" href="/x.css">
    `
    const m = extractBundleManifest(html)
    expect(m.scripts).toEqual(['/a.js'])
    expect(m.stylesheets).toEqual(['/x.css'])
  })

  it('returns empty arrays for HTML with no scripts or stylesheets', () => {
    const html = '<html><body><p>hello</p></body></html>'
    const m = extractBundleManifest(html)
    expect(m.scripts).toEqual([])
    expect(m.stylesheets).toEqual([])
  })

  it('handles a realistic Next.js exported page snippet', () => {
    const html = `
      <!DOCTYPE html><html><head>
        <link rel="stylesheet" href="/_next/static/css/abc.css" data-precedence="next">
        <link rel="preload" as="font" href="/font.woff2">
        <link rel="icon" href="/favicon.ico">
      </head><body>
        <div id="__next"></div>
        <script src="/_next/static/chunks/webpack-1.js" async></script>
        <script src="/_next/static/chunks/framework-2.js" async></script>
        <script src="/_next/static/chunks/main-app-3.js" async></script>
        <script src="/_next/static/chunks/app/layout-4.js" async></script>
        <script src="/_next/static/chunks/app/s/page-5.js" async></script>
      </body></html>
    `
    const m = extractBundleManifest(html)
    expect(m.scripts).toHaveLength(5)
    expect(m.scripts[0]).toBe('/_next/static/chunks/webpack-1.js')
    expect(m.scripts[4]).toBe('/_next/static/chunks/app/s/page-5.js')
    expect(m.stylesheets).toEqual(['/_next/static/css/abc.css'])
  })
})
