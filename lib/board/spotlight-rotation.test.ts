import { describe, it, expect } from 'vitest'
import { reconcileSpotlight, rotateSpotlight, EMPTY_SPOTLIGHT } from './spotlight-rotation'

const set = (...ids: string[]): ReadonlySet<string> => new Set(ids)

describe('reconcileSpotlight', () => {
  it('fills empty live slots up to cap from the candidate set (most-visible first)', () => {
    const s = reconcileSpotlight(EMPTY_SPOTLIGHT, set('a', 'b', 'c', 'd', 'e'), 3)
    expect(s.live).toEqual(['a', 'b', 'c'])
    expect(s.waiting).toEqual(['d', 'e'])
  })

  it('plays everyone when candidates do not exceed cap (nothing queued)', () => {
    const s = reconcileSpotlight(EMPTY_SPOTLIGHT, set('a', 'b'), 3)
    expect(s.live).toEqual(['a', 'b'])
    expect(s.waiting).toEqual([])
  })

  it('drops a live card that left the viewport and promotes the next waiting one', () => {
    const prev = { live: ['a', 'b', 'c'], waiting: ['d'] }
    const s = reconcileSpotlight(prev, set('a', 'c', 'd'), 3) // b gone
    expect(s.live).toEqual(['a', 'c', 'd'])
    expect(s.waiting).toEqual([])
  })

  it('trims live down when cap drops to 0 (motion off → nothing plays)', () => {
    const prev = { live: ['a', 'b', 'c'], waiting: ['d'] }
    const s = reconcileSpotlight(prev, set('a', 'b', 'c', 'd'), 0)
    expect(s.live).toEqual([])
    expect(new Set(s.waiting)).toEqual(set('a', 'b', 'c', 'd'))
  })

  it('keeps already-live cards live (no needless churn) when candidates unchanged', () => {
    const prev = { live: ['a', 'b', 'c'], waiting: ['d', 'e'] }
    const s = reconcileSpotlight(prev, set('a', 'b', 'c', 'd', 'e'), 3)
    expect(s.live).toEqual(['a', 'b', 'c'])
  })
})

describe('rotateSpotlight', () => {
  it('retires the oldest live card and promotes the front of the queue', () => {
    const prev = { live: ['a', 'b', 'c'], waiting: ['d', 'e'] }
    const s = rotateSpotlight(prev, 3)
    expect(s.live).toEqual(['b', 'c', 'd']) // a retired, d promoted
    expect(s.waiting).toEqual(['e', 'a']) // a goes to the back of the line
  })

  it('is a no-op when nobody is waiting (≤ cap candidates → all play)', () => {
    const prev = { live: ['a', 'b'], waiting: [] }
    expect(rotateSpotlight(prev, 3)).toBe(prev)
  })

  it('is a no-op when cap is 0', () => {
    const prev = { live: [], waiting: ['a', 'b'] }
    expect(rotateSpotlight(prev, 0)).toBe(prev)
  })

  it('promotes the picked waiting index (random in the hook) and never the just-retired card', () => {
    const prev = { live: ['a', 'b', 'c'], waiting: ['d', 'e', 'f'] }
    const s = rotateSpotlight(prev, 3, () => 2) // pick 'f' (index 2 of waiting)
    expect(s.live).toEqual(['b', 'c', 'f']) // a retired, f promoted
    expect(s.waiting).toEqual(['d', 'e', 'a']) // f removed, a appended at back
    expect(s.live).not.toContain('a') // the retired card is never re-promoted this turn
  })

  it('clamps an out-of-range pick index safely', () => {
    const prev = { live: ['a', 'b'], waiting: ['c', 'd'] }
    const s = rotateSpotlight(prev, 2, () => 99)
    expect(s.live).toEqual(['b', 'd']) // clamped to last waiting index
  })

  it('cycles fairly over many turns: every candidate gets a turn', () => {
    let s = reconcileSpotlight(EMPTY_SPOTLIGHT, set('a', 'b', 'c', 'd', 'e'), 3)
    const seen = new Set<string>(s.live)
    for (let i = 0; i < 5; i++) { s = rotateSpotlight(s, 3); s.live.forEach((id) => seen.add(id)) }
    expect(seen).toEqual(set('a', 'b', 'c', 'd', 'e'))
  })
})
