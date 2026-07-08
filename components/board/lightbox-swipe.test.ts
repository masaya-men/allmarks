import { describe, it, expect } from 'vitest'
import { resolveAxis, resolveIntent } from './lightbox-swipe'

describe('resolveAxis', () => {
  it('locks to none under the threshold', () => {
    expect(resolveAxis(3, 3)).toBe('none')
  })
  it('locks horizontal when |dx| dominates', () => {
    expect(resolveAxis(20, 5)).toBe('horizontal')
  })
  it('locks vertical when |dy| dominates', () => {
    expect(resolveAxis(5, 20)).toBe('vertical')
  })
  it('ties break horizontal (equal magnitude past lock)', () => {
    expect(resolveAxis(20, 20)).toBe('horizontal')
  })
})

describe('resolveIntent', () => {
  const base = { vx: 0, vy: 0, viewportW: 400, viewportH: 800 } as const

  it('swipe left past NAV_RATIO → next', () => {
    expect(resolveIntent({ ...base, axis: 'horizontal', dx: -200, dy: 0 })).toBe('next')
  })
  it('swipe right past NAV_RATIO → prev', () => {
    expect(resolveIntent({ ...base, axis: 'horizontal', dx: 200, dy: 0 })).toBe('prev')
  })
  it('short horizontal drag → none', () => {
    expect(resolveIntent({ ...base, axis: 'horizontal', dx: -40, dy: 0 })).toBe('none')
  })
  it('fast horizontal flick under distance → next', () => {
    expect(resolveIntent({ ...base, axis: 'horizontal', dx: -40, dy: 0, vx: -1 })).toBe('next')
  })
  it('next blocked at next-end boundary', () => {
    expect(resolveIntent({ ...base, axis: 'horizontal', dx: -200, dy: 0, atEnd: { prev: false, next: true } })).toBe('none')
  })
  it('prev blocked at prev-end boundary', () => {
    expect(resolveIntent({ ...base, axis: 'horizontal', dx: 200, dy: 0, atEnd: { prev: true, next: false } })).toBe('none')
  })
  it('down past CLOSE_RATIO → close', () => {
    expect(resolveIntent({ ...base, axis: 'vertical', dx: 0, dy: 300 })).toBe('close')
  })
  it('up past SHEET_RATIO → sheet', () => {
    expect(resolveIntent({ ...base, axis: 'vertical', dx: 0, dy: -200 })).toBe('sheet')
  })
  it('small downward drag → none', () => {
    expect(resolveIntent({ ...base, axis: 'vertical', dx: 0, dy: 40 })).toBe('none')
  })
  it('small upward drag → none', () => {
    expect(resolveIntent({ ...base, axis: 'vertical', dx: 0, dy: -40 })).toBe('none')
  })
  it('fast downward flick under distance → close', () => {
    expect(resolveIntent({ ...base, axis: 'vertical', dx: 0, dy: 40, vy: 1 })).toBe('close')
  })
  it('undecided axis → none', () => {
    expect(resolveIntent({ ...base, axis: 'none', dx: 0, dy: 0 })).toBe('none')
  })
})
