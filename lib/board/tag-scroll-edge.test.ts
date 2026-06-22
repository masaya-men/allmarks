import { describe, it, expect } from 'vitest'
import { computeTagScrollEdge } from './tag-scroll-edge'

/** The scroller's CSS max-height (see FilterPill.module.css .tagScroll). */
const CAP = 264
const ROW = 35

describe('computeTagScrollEdge', () => {
  describe('short, fully-fitting list never fades', () => {
    it('1 tag, settled (clientHeight == scrollHeight) → none', () => {
      expect(computeTagScrollEdge({ scrollHeight: ROW, scrollTop: 0, clientHeight: ROW, maxHeight: CAP })).toBe('none')
    })

    // Regression: during the dropdown's grid 0fr→1fr open animation the
    // clientHeight ramps up from ~0. The OLD clientHeight-based check read these
    // frames as "overflowing" and flashed a fade over the only tag. The fix
    // measures against the constant max-height, so every animation frame is 'none'.
    it.each([0, 8, 14, 30, 34])('1 tag, mid-open clientHeight=%d → none (no flash)', (clientHeight) => {
      expect(computeTagScrollEdge({ scrollHeight: ROW, scrollTop: 0, clientHeight, maxHeight: CAP })).toBe('none')
    })

    it('3 tags fit under the cap, mid-open → none', () => {
      expect(computeTagScrollEdge({ scrollHeight: 104, scrollTop: 0, clientHeight: 0, maxHeight: CAP })).toBe('none')
    })

    it('list exactly at the cap (no real overflow) → none', () => {
      expect(computeTagScrollEdge({ scrollHeight: CAP, scrollTop: 0, clientHeight: CAP, maxHeight: CAP })).toBe('none')
    })

    it('1px over the cap is within tolerance → none', () => {
      expect(computeTagScrollEdge({ scrollHeight: CAP + 1, scrollTop: 0, clientHeight: CAP, maxHeight: CAP })).toBe('none')
    })
  })

  describe('genuinely overflowing list fades correctly', () => {
    const OVER = 725 // ~21 rows

    it('overflow, scrolled to top → top fade', () => {
      expect(computeTagScrollEdge({ scrollHeight: OVER, scrollTop: 0, clientHeight: CAP, maxHeight: CAP })).toBe('top')
    })

    it('overflow, scrolled to the middle → middle fade', () => {
      expect(computeTagScrollEdge({ scrollHeight: OVER, scrollTop: 200, clientHeight: CAP, maxHeight: CAP })).toBe('middle')
    })

    it('overflow, scrolled to the bottom → bottom fade', () => {
      expect(computeTagScrollEdge({ scrollHeight: OVER, scrollTop: OVER - CAP, clientHeight: CAP, maxHeight: CAP })).toBe('bottom')
    })

    // Even before the open animation settles, an overflowing list reads 'top'
    // (correct) from the first frame because the cap, not clientHeight, decides.
    it('overflow, mid-open clientHeight smaller than cap → top', () => {
      expect(computeTagScrollEdge({ scrollHeight: OVER, scrollTop: 0, clientHeight: 47, maxHeight: CAP })).toBe('top')
    })

    it('2px over the cap counts as overflow → top', () => {
      expect(computeTagScrollEdge({ scrollHeight: CAP + 2, scrollTop: 0, clientHeight: CAP, maxHeight: CAP })).toBe('top')
    })
  })

  describe('max-height fallback', () => {
    it('falls back to clientHeight when maxHeight is NaN', () => {
      // No usable cap → behave like the classic clientHeight overflow check.
      expect(computeTagScrollEdge({ scrollHeight: 500, scrollTop: 0, clientHeight: 264, maxHeight: NaN })).toBe('top')
      expect(computeTagScrollEdge({ scrollHeight: 100, scrollTop: 0, clientHeight: 264, maxHeight: NaN })).toBe('none')
    })
  })
})
