import { describe, it, expect } from 'vitest'
import { findMissingAnchors, REQUIRED_ANCHORS } from './assert-share-template.mjs'

// A realistic slice of Next's exported out/s.html head (matches the live build —
// verified against the real file). patchShareHTML's regexes target these exact
// tags, so the assertion must accept this shape and reject anything missing one.
const goodHead =
  `<!DOCTYPE html><html lang="en"><head>` +
  `<meta charSet="utf-8"/>` +
  `<title>AllMarks — Bookmark × Collage</title>` +
  `<meta property="og:title" content="AllMarks — Bookmark × Collage"/>` +
  `<meta property="og:description" content="Turn your bookmarks into beautiful visual collages."/>` +
  `<meta property="og:type" content="website"/>` +
  `</head><body></body></html>`

describe('assert-share-template / findMissingAnchors', () => {
  it('reports no missing anchors for the real exported head shape', () => {
    expect(findMissingAnchors(goodHead)).toEqual([])
  })

  it('detects a missing og:type anchor (the og:url/og:image injection point)', () => {
    const broken = goodHead.replace(/<meta property="og:type"[^>]*>/, '')
    const missing = findMissingAnchors(broken)
    expect(missing.length).toBe(1)
    expect(missing[0]).toMatch(/og:type/)
  })

  it('detects a missing <title> anchor', () => {
    const broken = goodHead.replace(/<title>[\s\S]*?<\/title>/, '')
    expect(findMissingAnchors(broken).some((m) => m.includes('<title>'))).toBe(true)
  })

  it('flags every anchor when given empty HTML', () => {
    expect(findMissingAnchors('').length).toBe(REQUIRED_ANCHORS.length)
  })

  it('detects an og:title whose attribute order Next might change (no content=)', () => {
    // If a future Next emits og:title without a content="" the replace target is
    // gone — patchShareHTML would no-op, so this MUST be caught.
    const broken = goodHead.replace(
      /<meta property="og:title"[^>]*>/,
      '<meta property="og:title"/>',
    )
    expect(findMissingAnchors(broken).some((m) => m.includes('og:title'))).toBe(true)
  })
})
