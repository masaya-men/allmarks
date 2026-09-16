import { describe, it, expect } from 'vitest'
import { formatLastSynced } from './format-last-sync'

describe('formatLastSynced', () => {
  const now = 1_000_000_000_000

  it('returns never when lastSyncAt is undefined', () => {
    expect(formatLastSynced(undefined, now)).toEqual({ kind: 'never' })
  })
  it('returns just-now for under a minute', () => {
    expect(formatLastSynced(now - 30_000, now)).toEqual({ kind: 'just-now' })
  })
  it('returns minutes for 5 minutes ago', () => {
    expect(formatLastSynced(now - 5 * 60_000, now)).toEqual({ kind: 'minutes', value: 5 })
  })
  it('returns hours for 2 hours ago', () => {
    expect(formatLastSynced(now - 2 * 60 * 60_000, now)).toEqual({ kind: 'hours', value: 2 })
  })
  it('returns days for 3 days ago', () => {
    expect(formatLastSynced(now - 3 * 24 * 60 * 60_000, now)).toEqual({ kind: 'days', value: 3 })
  })
  it('clamps a lastSyncAt slightly in the future to just-now (clock skew)', () => {
    expect(formatLastSynced(now + 5000, now)).toEqual({ kind: 'just-now' })
  })
})
