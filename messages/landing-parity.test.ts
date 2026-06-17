import { describe, it, expect } from 'vitest'
import en from './en.json'
import ja from './ja.json'

function keyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object'
      ? keyPaths(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  )
}

describe('landing namespace parity', () => {
  it('en has a landing namespace', () => {
    expect((en as Record<string, unknown>).landing).toBeDefined()
  })
  it('en.landing and ja.landing share identical key shape', () => {
    const e = keyPaths((en as { landing: Record<string, unknown> }).landing).sort()
    const j = keyPaths((ja as { landing: Record<string, unknown> }).landing).sort()
    expect(j).toEqual(e)
  })
})
