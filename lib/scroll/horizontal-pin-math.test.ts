import { describe, it, expect } from 'vitest'
import { horizontalScrollDistance, panelProgress } from './horizontal-pin-math'

describe('horizontalScrollDistance', () => {
  it('トラックが viewport より広い分だけ移動量になる', () => {
    expect(horizontalScrollDistance(5000, 1000)).toBe(4000)
  })
  it('トラックが viewport 以下なら 0(負にしない)', () => {
    expect(horizontalScrollDistance(800, 1000)).toBe(0)
  })
})

describe('panelProgress', () => {
  it('5パネル中、全体進捗0.0 は先頭パネルのローカル進捗0', () => {
    expect(panelProgress(0, 5, 0)).toBe(0)
  })
  it('5パネル中、全体進捗0.1 は先頭パネル(0..0.2区間)のローカル0.5', () => {
    expect(panelProgress(0.1, 5, 0)).toBeCloseTo(0.5)
  })
  it('範囲より前のパネルは0、後のパネルは1にクランプ', () => {
    expect(panelProgress(0.1, 5, 2)).toBe(0) // パネル2は0.4..0.6、まだ来てない
    expect(panelProgress(0.9, 5, 0)).toBe(1) // パネル0はとっくに過ぎた
  })
})
