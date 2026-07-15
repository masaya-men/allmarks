import { describe, it, expect } from 'vitest'
import { getTextTransition } from './index'

describe('getTextTransition — quiet', () => {
  it('quiet transition has no loading/exit glitch', () => {
    const t = getTextTransition('quiet')
    expect(t.loadingClass).toBeNull()
    expect(t.exitClass).toBeNull()
  })
  it('glitch-crt still has a loading class (dark themes unchanged)', () => {
    expect(getTextTransition('glitch-crt').loadingClass).not.toBeNull()
  })
})
