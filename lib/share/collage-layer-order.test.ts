import { describe, expect, it } from 'vitest'
import { sendToBack } from './collage-layer-order'

describe('sendToBack', () => {
  it('moves the id to the front of the array (= back of the z-order)', () => {
    expect(sendToBack(['a', 'b', 'c'], 'c')).toEqual(['c', 'a', 'b'])
  })
  it('keeps ordering when the id is already first', () => {
    expect(sendToBack(['a', 'b', 'c'], 'a')).toEqual(['a', 'b', 'c'])
  })
  it('returns a copy (not the same reference) for a known id', () => {
    const order = ['a', 'b']
    const out = sendToBack(order, 'b')
    expect(out).toEqual(['b', 'a'])
    expect(out).not.toBe(order)
  })
  it('returns a copy for an unknown id without changing order', () => {
    expect(sendToBack(['a', 'b'], 'z')).toEqual(['a', 'b'])
  })
})
