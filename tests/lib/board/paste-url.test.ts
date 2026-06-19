import { describe, it, expect } from 'vitest'
import { extractSinglePastedUrl, isEditableTarget } from '@/lib/board/paste-url'

describe('extractSinglePastedUrl', () => {
  it('returns the URL for a single clean http(s) URL', () => {
    expect(extractSinglePastedUrl('https://example.com/a')).toBe('https://example.com/a')
    expect(extractSinglePastedUrl('  http://x.io  ')).toBe('http://x.io')
  })
  it('returns null for non-URL text', () => {
    expect(extractSinglePastedUrl('just some words')).toBeNull()
    expect(extractSinglePastedUrl('')).toBeNull()
  })
  it('returns null when text has a URL plus other tokens (MVP = single only)', () => {
    expect(extractSinglePastedUrl('look https://x.io here')).toBeNull()
    expect(extractSinglePastedUrl('https://a.com https://b.com')).toBeNull()
  })
  it('returns null for non-http protocols', () => {
    expect(extractSinglePastedUrl('javascript:alert(1)')).toBeNull()
    expect(extractSinglePastedUrl('ftp://a.com')).toBeNull()
  })
})

describe('isEditableTarget', () => {
  it('true for input/textarea', () => {
    const input = document.createElement('input')
    const ta = document.createElement('textarea')
    expect(isEditableTarget(input)).toBe(true)
    expect(isEditableTarget(ta)).toBe(true)
  })
  it('true for contenteditable ancestor', () => {
    const outer = document.createElement('div')
    outer.setAttribute('contenteditable', 'true')
    const inner = document.createElement('span')
    outer.appendChild(inner)
    expect(isEditableTarget(inner)).toBe(true)
  })
  it('false for a plain div and for null', () => {
    expect(isEditableTarget(document.createElement('div'))).toBe(false)
    expect(isEditableTarget(null)).toBe(false)
  })
})
