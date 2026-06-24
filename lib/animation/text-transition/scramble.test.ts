import { describe, it, expect, vi } from 'vitest'
import { getTextTransition } from './index'
import { buildSettleSchedule, computeRevealFrame } from './themes/scramble'

describe('scramble reveal math', () => {
  it('buildSettleSchedule grows monotonically and matches length', () => {
    const s = buildSettleSchedule(5, () => 0) // rand=0 → deterministic
    expect(s).toHaveLength(5)
    for (let i = 1; i < s.length; i++) expect(s[i]).toBeGreaterThan(s[i - 1])
  })

  it('computeRevealFrame shows target chars where settled, preserves spaces and length', () => {
    const target = 'ab cd'
    const schedule = [10, 20, 30, 40, 50]
    const frame = computeRevealFrame(target, 1000, schedule) // all settled
    expect(frame).toBe('ab cd')
    const early = computeRevealFrame(target, 0, schedule) // none settled
    expect(early.length).toBe(target.length)
    expect(early[2]).toBe(' ') // space index always preserved
  })
})

describe('getTextTransition (default theme)', () => {
  it('reduced-motion immediately emits toText with no glitch', () => {
    const onFrame = vi.fn()
    const onGlitch = vi.fn()
    const t = getTextTransition('default')
    t.run({ fromText: 'Hola', toText: 'Hello', onFrame, onGlitch, reducedMotion: true })
    expect(onFrame).toHaveBeenLastCalledWith('Hello')
    expect(onGlitch).not.toHaveBeenCalled()
  })

  it('reduced-motion with null toText keeps fromText until settle', () => {
    const onFrame = vi.fn()
    const t = getTextTransition('default')
    const h = t.run({ fromText: 'Hola', toText: null, onFrame, reducedMotion: true })
    expect(onFrame).toHaveBeenLastCalledWith('Hola')
    h.settle('Hello')
    expect(onFrame).toHaveBeenLastCalledWith('Hello')
  })

  it('unknown theme falls back to default (no throw)', () => {
    expect(() => getTextTransition('does-not-exist').run({
      fromText: 'a', toText: 'b', onFrame: () => {}, reducedMotion: true,
    })).not.toThrow()
  })

  it('cancel after settle stops further frames in reduced-motion path', () => {
    const onFrame = vi.fn()
    const t = getTextTransition('default')
    const h = t.run({ fromText: 'a', toText: 'b', onFrame, reducedMotion: true })
    h.cancel()
    const callsAfterCancel = onFrame.mock.calls.length
    h.settle('c')
    expect(onFrame.mock.calls.length).toBe(callsAfterCancel) // no new frame
  })
})
