// functions/s/patch-share-html.test.ts
import { describe, it, expect } from 'vitest'
import { patchShareHTML } from './patch-share-html'

// Realistic Next.js 16 exported HTML fragment for /s page — head with og:title,
// og:description, og:type already present (= we patch / inject around them) and
// streaming RSC scripts in body (= we MUST NOT touch them or hydration breaks).
const sampleTemplate = `<!DOCTYPE html><html lang="ja"><head>` +
  `<meta charSet="utf-8"/>` +
  `<title>Booklage — Bookmark × Collage</title>` +
  `<meta property="og:title" content="Booklage — Bookmark × Collage"/>` +
  `<meta property="og:description" content="Turn your bookmarks into beautiful visual collages."/>` +
  `<meta property="og:type" content="website"/>` +
  `<meta name="twitter:card" content="summary_large_image"/>` +
  `<link rel="icon" href="/favicon.ico"/>` +
  `<script src="/_next/static/chunks/abc.js" async=""></script>` +
  `</head><body class="x"><div id="__next"></div>` +
  `<script>self.__next_f.push([0])</script>` +
  `<script>self.__next_f.push([1,"important rsc data"])</script>` +
  `</body></html>`

const baseVars = {
  id: 'k3p9xv',
  cardCount: 12,
  baseUrl: 'https://booklage.pages.dev',
  page: 'landing' as const,
}

describe('patchShareHTML', () => {
  it('replaces the document <title>', () => {
    const out = patchShareHTML(sampleTemplate, baseVars)
    expect(out).toContain('<title>Shared collection on AllMarks</title>')
    expect(out).not.toContain('Booklage — Bookmark × Collage')
  })

  it('replaces og:title content', () => {
    const out = patchShareHTML(sampleTemplate, baseVars)
    expect(out).toMatch(/<meta\s+property="og:title"\s+content="Shared collection on AllMarks"/)
  })

  it('replaces og:description with the card count', () => {
    const out = patchShareHTML(sampleTemplate, baseVars)
    expect(out).toMatch(/og:description[^>]*12 bookmarks/)
  })

  it('injects og:url for the landing page', () => {
    const out = patchShareHTML(sampleTemplate, baseVars)
    expect(out).toContain('content="https://booklage.pages.dev/s/k3p9xv"')
  })

  it('injects og:url for the triage page', () => {
    const out = patchShareHTML(sampleTemplate, { ...baseVars, page: 'triage' })
    expect(out).toContain('content="https://booklage.pages.dev/s/k3p9xv/triage"')
  })

  it('injects og:image pointing to /api/share/<id>/og', () => {
    const out = patchShareHTML(sampleTemplate, baseVars)
    expect(out).toContain('property="og:image" content="https://booklage.pages.dev/api/share/k3p9xv/og"')
  })

  it('injects twitter:image so X cards show the per-id thumbnail', () => {
    const out = patchShareHTML(sampleTemplate, baseVars)
    expect(out).toMatch(/<meta\s+name="twitter:image"\s+content="https:\/\/booklage\.pages\.dev\/api\/share\/k3p9xv\/og"/)
  })

  it('injects window.__SHARE_ID__ and window.__SHARE_CARD_COUNT__ early in <head>', () => {
    const out = patchShareHTML(sampleTemplate, baseVars)
    expect(out).toMatch(/window\.__SHARE_ID__\s*=\s*"k3p9xv"/)
    expect(out).toMatch(/window\.__SHARE_CARD_COUNT__\s*=\s*12/)
    // share-id script must appear before the Next.js bundle scripts to set globals
    // before the bundle runs.
    const shareIdIdx = out.indexOf('__SHARE_ID__')
    const bundleIdx = out.indexOf('/_next/static/chunks/abc.js')
    expect(shareIdIdx).toBeGreaterThan(-1)
    expect(bundleIdx).toBeGreaterThan(-1)
    expect(shareIdIdx).toBeLessThan(bundleIdx)
  })

  it('preserves the streaming RSC scripts verbatim (= hydration depends on them)', () => {
    const out = patchShareHTML(sampleTemplate, baseVars)
    expect(out).toContain('self.__next_f.push([0])')
    expect(out).toContain('self.__next_f.push([1,"important rsc data"])')
  })

  it('preserves the Next.js bundle <script> tags verbatim (= bundle paths must not break)', () => {
    const out = patchShareHTML(sampleTemplate, baseVars)
    expect(out).toContain('<script src="/_next/static/chunks/abc.js" async=""></script>')
  })

  it('supports an alternative base URL (= future allmarks.app swap)', () => {
    const out = patchShareHTML(sampleTemplate, { ...baseVars, baseUrl: 'https://allmarks.app' })
    expect(out).toContain('content="https://allmarks.app/s/k3p9xv"')
    expect(out).toContain('content="https://allmarks.app/api/share/k3p9xv/og"')
  })

  it('handles cardCount=0 gracefully', () => {
    const out = patchShareHTML(sampleTemplate, { ...baseVars, cardCount: 0 })
    expect(out).toMatch(/og:description[^>]*0 bookmarks/)
    expect(out).toMatch(/window\.__SHARE_CARD_COUNT__\s*=\s*0/)
  })
})
