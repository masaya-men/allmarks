import { describe, it, expect } from 'vitest'
import { classifyBoardPointerDown } from './grab-gesture'

const base = { button: 0, spaceHeld: false, isSelfTarget: true, wiggleEnabled: true }

describe('classifyBoardPointerDown', () => {
  it('middle button → pan (even over a card)', () => {
    expect(classifyBoardPointerDown({ ...base, button: 1, isSelfTarget: false })).toBe('pan')
  })

  it('left + Space → pan (even over a card)', () => {
    expect(classifyBoardPointerDown({ ...base, spaceHeld: true, isSelfTarget: false })).toBe('pan')
  })

  it('plain left on empty + wiggle enabled → wiggle', () => {
    expect(classifyBoardPointerDown({ ...base })).toBe('wiggle')
  })

  it('plain left on empty + wiggle disabled → pan (existing scroll)', () => {
    expect(classifyBoardPointerDown({ ...base, wiggleEnabled: false })).toBe('pan')
  })

  it('plain left over a card → ignore', () => {
    expect(classifyBoardPointerDown({ ...base, isSelfTarget: false })).toBe('ignore')
  })

  it('right button on empty → pan (existing quirk preserved)', () => {
    expect(classifyBoardPointerDown({ ...base, button: 2 })).toBe('pan')
  })

  it('right button over a card → ignore', () => {
    expect(classifyBoardPointerDown({ ...base, button: 2, isSelfTarget: false })).toBe('ignore')
  })

  it('plain left on empty + marquee enabled → marquee (even when wiggle is also enabled)', () => {
    expect(classifyBoardPointerDown({ ...base, marqueeEnabled: true })).toBe('marquee')
  })

  it('marquee takes priority over wiggle', () => {
    expect(classifyBoardPointerDown({ ...base, wiggleEnabled: true, marqueeEnabled: true })).toBe('marquee')
  })

  it('marquee enabled but not self-target (over a card) → ignore', () => {
    expect(classifyBoardPointerDown({ ...base, isSelfTarget: false, marqueeEnabled: true })).toBe('ignore')
  })

  it('middle button still pans even when marquee is enabled', () => {
    expect(classifyBoardPointerDown({ ...base, button: 1, marqueeEnabled: true })).toBe('pan')
  })

  it('left + Space still pans even when marquee is enabled', () => {
    expect(classifyBoardPointerDown({ ...base, spaceHeld: true, marqueeEnabled: true })).toBe('pan')
  })

  it('marqueeEnabled defaults to false when omitted', () => {
    expect(classifyBoardPointerDown({ button: 0, spaceHeld: false, isSelfTarget: true, wiggleEnabled: true })).toBe('wiggle')
  })
})
