import { describe, expect, it } from 'vitest'
import { classifyRelease, hitTestChip, type ChipRect } from './drag-gesture'

describe('hitTestChip', () => {
  const chips: ChipRect[] = [
    { tagId: 'a', left: 0, top: 0, right: 100, bottom: 50 },
    { tagId: 'b', left: 120, top: 0, right: 220, bottom: 50 },
  ]

  it('returns the tag whose rect contains the pointer', () => {
    expect(hitTestChip(50, 25, chips)).toBe('a')
    expect(hitTestChip(150, 25, chips)).toBe('b')
  })

  it('returns null in the gap between chips', () => {
    expect(hitTestChip(110, 25, chips)).toBeNull()
  })

  it('returns null below the chip row', () => {
    expect(hitTestChip(50, 400, chips)).toBeNull()
  })

  it('is inclusive of the rect edges', () => {
    expect(hitTestChip(0, 0, chips)).toBe('a')
    expect(hitTestChip(100, 50, chips)).toBe('a')
  })

  it('returns the first match when rects overlap', () => {
    const overlapping: ChipRect[] = [
      { tagId: 'x', left: 0, top: 0, right: 100, bottom: 50 },
      { tagId: 'y', left: 50, top: 0, right: 150, bottom: 50 },
    ]
    expect(hitTestChip(75, 25, overlapping)).toBe('x')
  })
})

describe('classifyRelease', () => {
  it('a release over a chip tags it, regardless of distance', () => {
    expect(classifyRelease({ dx: 0, dy: -300, targetTagId: 'design' })).toEqual({
      kind: 'tag',
      tagId: 'design',
    })
    // chip wins even if the horizontal distance would otherwise be a swipe
    expect(classifyRelease({ dx: 200, dy: -250, targetTagId: 'music' })).toEqual({
      kind: 'tag',
      tagId: 'music',
    })
  })

  it('treats a near-stationary release as a tap (open)', () => {
    expect(classifyRelease({ dx: 0, dy: 0, targetTagId: null })).toEqual({ kind: 'open' })
    expect(classifyRelease({ dx: 3, dy: 2, targetTagId: null })).toEqual({ kind: 'open' })
  })

  it('classifies a rightward horizontal drag as yes', () => {
    expect(classifyRelease({ dx: 80, dy: 5, targetTagId: null })).toEqual({ kind: 'yes' })
  })

  it('classifies a leftward horizontal drag as no', () => {
    expect(classifyRelease({ dx: -80, dy: 5, targetTagId: null })).toEqual({ kind: 'no' })
  })

  it('requires the drag to clear the swipe threshold', () => {
    // moved more than the tap threshold but less than the swipe threshold
    expect(classifyRelease({ dx: 30, dy: 5, targetTagId: null })).toEqual({ kind: 'cancel' })
  })

  it('does not swipe when the motion is mostly vertical and misses every chip', () => {
    // dragged up toward the strip but released in a gap (no targetTagId)
    expect(classifyRelease({ dx: 20, dy: -200, targetTagId: null })).toEqual({ kind: 'cancel' })
  })

  it('honours custom thresholds', () => {
    expect(
      classifyRelease({ dx: 10, dy: 0, targetTagId: null, tapThresholdPx: 4, swipeThresholdPx: 8 }),
    ).toEqual({ kind: 'yes' })
  })
})
