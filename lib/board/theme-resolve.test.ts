import { describe, it, expect } from 'vitest'
import { resolveThemeId } from './theme-resolve'
import { EMPTY_LICENSES } from './theme-entitlement'

describe('resolveThemeId', () => {
  it('returns a known free theme as-is', () => {
    expect(resolveThemeId('paper-atelier', EMPTY_LICENSES)).toBe('paper-atelier')
  })
  it('falls back to default for an unknown id', () => {
    expect(resolveThemeId('no-such-theme', EMPTY_LICENSES)).toBe('dotted-notebook')
  })
  it('falls back to default for undefined', () => {
    expect(resolveThemeId(undefined, EMPTY_LICENSES)).toBe('dotted-notebook')
  })
})
