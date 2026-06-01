import { describe, it, expect } from 'vitest'
import { orderForImport } from './receiver-import-order'

describe('orderForImport', () => {
  it('reverses so the sender top card is saved last (= highest orderIndex = top)', () => {
    const visible = ['a', 'b', 'c'] // a = sender top
    expect(orderForImport(visible)).toEqual(['c', 'b', 'a'])
  })
  it('keeps a single card unchanged', () => {
    expect(orderForImport(['only'])).toEqual(['only'])
  })
  it('returns empty for empty input', () => {
    expect(orderForImport([])).toEqual([])
  })
})
