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
})
