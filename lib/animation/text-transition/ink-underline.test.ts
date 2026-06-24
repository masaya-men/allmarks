import { describe, it, expect } from 'vitest'
import { getTextTransition } from './index'

describe('getTextTransition — ink-underline', () => {
  it('ink-underline returns a full descriptor (loadingClass/exitClass/exitMs/playEntry)', () => {
    const t = getTextTransition('ink-underline')
    expect(typeof t.exitMs).toBe('number')
    expect(t.exitMs).toBeGreaterThan(0)
    expect(typeof t.playEntry).toBe('function')
    // loadingClass is the CSS-module underline-draw class (a non-empty string)
    expect(typeof t.loadingClass).toBe('string')
    expect((t.loadingClass ?? '').length).toBeGreaterThan(0)
  })

  it("'default' and 'glitch-crt' still resolve to the glitch transition", () => {
    expect(getTextTransition('default').exitMs).toBe(getTextTransition('glitch-crt').exitMs)
    // ink-underline must NOT collide with glitch's exit timing (distinct cadence)
    expect(getTextTransition('ink-underline').exitMs).not.toBe(getTextTransition('default').exitMs)
  })

  it('unknown theme still falls back to glitch (default), not ink-underline', () => {
    expect(getTextTransition('nope').exitMs).toBe(getTextTransition('default').exitMs)
  })

  it('playEntry with reducedMotion=true settles to finalText immediately and returns a cancel fn', () => {
    const t = getTextTransition('ink-underline')
    let shown = ''
    const cancel = t.playEntry({ el: null, finalText: 'Hola', setText: (s) => { shown = s }, reducedMotion: true })
    expect(shown).toBe('Hola')
    expect(typeof cancel).toBe('function')
    expect(() => cancel()).not.toThrow()
  })

  it('playEntry with el=null (non-reduced) still settles text without throwing', () => {
    const t = getTextTransition('ink-underline')
    let shown = ''
    const cancel = t.playEntry({ el: null, finalText: 'Bonjour', setText: (s) => { shown = s }, reducedMotion: false })
    expect(shown).toBe('Bonjour')
    cancel()
  })
})
