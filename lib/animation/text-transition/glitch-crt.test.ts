import { describe, it, expect } from 'vitest'
import { getTextTransition } from './index'
import {
  pickScrambleIndices, buildSubsetSchedule, computeSubsetFrame,
} from './themes/glitch-crt'

describe('pickScrambleIndices', () => {
  it('selects ~fraction of non-space chars, deterministic with injected rand', () => {
    const text = 'abcdefghij' // 10 non-space chars
    const idx = pickScrambleIndices(text, 0.1, () => 0)
    expect(idx).toHaveLength(1) // round(10 * 0.1) = 1
    expect(idx[0]).toBeGreaterThanOrEqual(0)
    expect(idx[0]).toBeLessThan(text.length)
  })

  it('never selects space or newline indices', () => {
    const text = 'a b\nc d e f g h i j k' // spaces/newline interleaved
    const idx = pickScrambleIndices(text, 1, () => 0) // fraction 1 = all candidates
    for (const i of idx) {
      expect(text[i]).not.toBe(' ')
      expect(text[i]).not.toBe('\n')
    }
  })

  it('returns at least one index when there is a non-space char', () => {
    expect(pickScrambleIndices('abc', 0.001, () => 0).length).toBeGreaterThanOrEqual(1)
  })

  it('returns empty for whitespace-only text', () => {
    expect(pickScrambleIndices('   ', 0.5)).toEqual([])
  })

  it('returns sorted, unique indices', () => {
    const idx = pickScrambleIndices('abcdefghijklmnop', 0.5, Math.random)
    const sorted = [...idx].sort((a, b) => a - b)
    expect(idx).toEqual(sorted)
    expect(new Set(idx).size).toBe(idx.length)
  })
})

describe('computeSubsetFrame', () => {
  it('keeps non-scheduled chars and spaces as target', () => {
    const target = 'ab cd'
    const schedule = new Map<number, number>([[0, 10]]) // only index 0 scheduled
    const early = computeSubsetFrame(target, 0, schedule)
    expect(early.length).toBe(target.length)
    expect(early.slice(1)).toBe('b cd') // indices 1.. untouched
    expect(early[2]).toBe(' ')
  })

  it('returns exactly target once all scheduled chars have settled', () => {
    const target = 'hello world'
    const schedule = buildSubsetSchedule([0, 6], 100, () => 0) // settle at 0ms
    expect(computeSubsetFrame(target, 1000, schedule)).toBe(target)
  })
})

describe('getTextTransition (default = glitch-crt)', () => {
  it('exposes loading/exit classes, exit duration, and playEntry', () => {
    const t = getTextTransition('default')
    expect(typeof t.exitMs).toBe('number')
    expect(t.exitMs).toBeGreaterThan(0)
    expect(typeof t.playEntry).toBe('function')
  })

  it('unknown theme falls back to default without throwing', () => {
    expect(() => getTextTransition('does-not-exist')).not.toThrow()
    expect(getTextTransition('does-not-exist').exitMs).toBe(getTextTransition('default').exitMs)
  })

  it('playEntry with reduced motion settles to finalText immediately and returns a cancel', () => {
    const t = getTextTransition('default')
    let shown = ''
    const cancel = t.playEntry({ el: null, finalText: 'Hello', setText: (s) => { shown = s }, reducedMotion: true })
    expect(shown).toBe('Hello')
    expect(() => cancel()).not.toThrow()
  })

  it('playEntry with el=null (non-reduced) still settles text without throwing', () => {
    const t = getTextTransition('default')
    let shown = ''
    const cancel = t.playEntry({ el: null, finalText: 'Bonjour', setText: (s) => { shown = s }, reducedMotion: false })
    expect(shown).toBe('Bonjour')
    cancel()
  })
})
