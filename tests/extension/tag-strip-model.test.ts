// tests/extension/tag-strip-model.test.ts
import { describe, it, expect } from 'vitest'
import { splitChips, shouldShowStrip, STRIP_MAX_CHIPS } from '@/extension/lib/tag-strip-model.js'

const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ id: 't' + i, name: 'tag' + i, color: '#28F100' }))

describe('splitChips', () => {
  it('keeps the first STRIP_MAX_CHIPS visible and overflows the rest', () => {
    const r = splitChips(mk(STRIP_MAX_CHIPS + 2))
    expect(r.visible).toHaveLength(STRIP_MAX_CHIPS)
    expect(r.overflow).toHaveLength(2)
    expect(r.hasOverflow).toBe(true)
  })
  it('no overflow when tags fit', () => {
    const r = splitChips(mk(3))
    expect(r.overflow).toHaveLength(0)
    expect(r.hasOverflow).toBe(false)
  })
})

describe('shouldShowStrip', () => {
  it('shows on saved/duplicate regardless of existing tag count', () => {
    expect(shouldShowStrip('saved', mk(1))).toBe(true)
    expect(shouldShowStrip('duplicate', mk(1))).toBe(true)
    // N-25 (launch-critical): zero existing tags MUST still show the strip —
    // the "+ ADD TAG" input lets a brand-new user create their first tag on
    // save. Gating on tags.length hid tagging from every new user.
    expect(shouldShowStrip('saved', [])).toBe(true)
    expect(shouldShowStrip('duplicate', [])).toBe(true)
  })
  it('hidden on error or while saving', () => {
    expect(shouldShowStrip('error', mk(1))).toBe(false)
    expect(shouldShowStrip('saving', mk(1))).toBe(false)
    expect(shouldShowStrip('error', [])).toBe(false)
  })
  it('hidden when tags is not a list (malformed reply)', () => {
    expect(shouldShowStrip('saved', undefined as unknown as [])).toBe(false)
    expect(shouldShowStrip('saved', null as unknown as [])).toBe(false)
  })
})
