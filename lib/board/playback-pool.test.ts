import { describe, it, expect } from 'vitest'
import {
  emptyPool,
  promote,
  demote,
  isActive,
  MAX_HOVER_PLAYERS,
} from './playback-pool'

describe('playback-pool', () => {
  it('starts empty', () => {
    expect(emptyPool.entries).toEqual([])
    expect(isActive(emptyPool, 'a')).toBe(false)
  })

  it('promote adds an entry and marks it active', () => {
    const s = promote(emptyPool, 'a', 1000)
    expect(isActive(s, 'a')).toBe(true)
    expect(s.entries).toHaveLength(1)
  })

  it('promote on an existing id refreshes lastActiveAt, no duplicate', () => {
    let s = promote(emptyPool, 'a', 1000)
    s = promote(s, 'a', 2000)
    expect(s.entries).toHaveLength(1)
    expect(s.entries[0]?.lastActiveAt).toBe(2000)
  })

  it('keeps at most MAX_HOVER_PLAYERS, dropping the oldest', () => {
    expect(MAX_HOVER_PLAYERS).toBe(3)
    let s = promote(emptyPool, 'a', 1000)
    s = promote(s, 'b', 2000)
    s = promote(s, 'c', 3000)
    s = promote(s, 'd', 4000) // 4th → 'a' (oldest) drops
    expect(s.entries).toHaveLength(3)
    expect(isActive(s, 'a')).toBe(false)
    expect(isActive(s, 'b')).toBe(true)
    expect(isActive(s, 'c')).toBe(true)
    expect(isActive(s, 'd')).toBe(true)
  })

  it('refreshing an entry protects it from being the LRU victim', () => {
    let s = promote(emptyPool, 'a', 1000)
    s = promote(s, 'b', 2000)
    s = promote(s, 'c', 3000)
    s = promote(s, 'a', 3500) // refresh 'a' → now 'b' is oldest
    s = promote(s, 'd', 4000) // 4th → 'b' drops, not 'a'
    expect(isActive(s, 'b')).toBe(false)
    expect(isActive(s, 'a')).toBe(true)
    expect(s.entries).toHaveLength(3)
  })

  it('demote removes an entry; demoting an absent id is a no-op', () => {
    let s = promote(emptyPool, 'a', 1000)
    s = demote(s, 'a')
    expect(isActive(s, 'a')).toBe(false)
    expect(demote(s, 'missing').entries).toEqual([])
  })
})
