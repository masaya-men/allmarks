import { describe, it, expect } from 'vitest'
import { SCRAMBLE_CHARS, pickRandomChar } from './scramble'

describe('scramble utility', () => {
  it('SCRAMBLE_CHARS contains uppercase letters, digits, and visual symbols', () => {
    expect(SCRAMBLE_CHARS).toMatch(/A/)
    expect(SCRAMBLE_CHARS).toMatch(/Z/)
    expect(SCRAMBLE_CHARS).toMatch(/0/)
    expect(SCRAMBLE_CHARS).toMatch(/9/)
    expect(SCRAMBLE_CHARS).toMatch(/·/)
    expect(SCRAMBLE_CHARS).toMatch(/#/)
  })

  it('pickRandomChar returns a single character from SCRAMBLE_CHARS', () => {
    for (let i = 0; i < 50; i++) {
      const ch = pickRandomChar()
      expect(ch.length).toBe(1)
      expect(SCRAMBLE_CHARS).toContain(ch)
    }
  })
})
