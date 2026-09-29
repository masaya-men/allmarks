import { describe, expect, it } from 'vitest'
import { meterProgress, meterTickAt, scrollFromPointer } from './page-scroll-meter'

describe('meterProgress', () => {
  // ページ 5000px・画面 800px → スクロールできる範囲は 4200px
  it('上端で 0、下端(最大)で 1、途中は比例する', () => {
    expect(meterProgress(0, 5000, 800)).toBe(0)
    expect(meterProgress(4200, 5000, 800)).toBe(1)
    expect(meterProgress(2100, 5000, 800)).toBeCloseTo(0.5, 10)
    expect(meterProgress(1050, 5000, 800)).toBeCloseTo(0.25, 10)
  })

  it('範囲外(はね返りの負・最大超え)は 0..1 に丸める', () => {
    expect(meterProgress(-120, 5000, 800)).toBe(0)
    expect(meterProgress(4300, 5000, 800)).toBe(1)
    expect(meterProgress(1e9, 5000, 800)).toBe(1)
  })

  it('動けないページ(高さ ≤ 画面)や NaN は 0', () => {
    expect(meterProgress(100, 800, 800)).toBe(0)
    expect(meterProgress(100, 600, 800)).toBe(0)
    expect(meterProgress(Number.NaN, 5000, 800)).toBe(0)
    expect(meterProgress(100, Number.NaN, 800)).toBe(0)
    expect(meterProgress(100, 5000, Number.NaN)).toBe(0)
  })
})

describe('meterTickAt', () => {
  it('その区画の上端が画面の頭に来るスクロール位置の進みと同じ値', () => {
    // 区画の上端が 1050px → スクロール 1050px で頭に来る → 進み 0.25
    expect(meterTickAt(1050, 5000, 800)).toBeCloseTo(0.25, 10)
    expect(meterTickAt(2100, 5000, 800)).toBeCloseTo(0.5, 10)
    expect(meterTickAt(1050, 5000, 800)).toBeCloseTo(meterProgress(1050, 5000, 800), 10)
  })

  it('ページの頭にある区画は 0、画面の頭まで上がれない最後の区画は 1(下端)に丸める', () => {
    expect(meterTickAt(0, 5000, 800)).toBe(0)
    expect(meterTickAt(4200, 5000, 800)).toBe(1)
    expect(meterTickAt(4400, 5000, 800)).toBe(1)
  })

  it('3 つの区切りは上から順に増える(区画が上から順に並ぶ限り)', () => {
    const [a, b, c] = [900, 2600, 4000].map((top) => meterTickAt(top, 5000, 800))
    expect(a).toBeLessThan(b)
    expect(b).toBeLessThan(c)
    expect(c).toBeLessThanOrEqual(1)
  })

  it('動けないページや NaN は 0', () => {
    expect(meterTickAt(300, 800, 800)).toBe(0)
    expect(meterTickAt(Number.NaN, 5000, 800)).toBe(0)
  })
})

describe('scrollFromPointer', () => {
  // メーター: 画面の y = 74px から高さ 596px(= 670px の画面 − 上 74px − 下 10px 相当)、最大スクロール 4200px
  const top = 74
  const height = 596
  const max = 4200

  it('上端で 0、下端で最大スクロール、途中は比例する', () => {
    expect(scrollFromPointer(top, top, height, max)).toBe(0)
    expect(scrollFromPointer(top + height, top, height, max)).toBe(max)
    expect(scrollFromPointer(top + height / 2, top, height, max)).toBeCloseTo(2100, 6)
    expect(scrollFromPointer(top + height / 4, top, height, max)).toBeCloseTo(1050, 6)
  })

  it('範囲外(メーターの上や下)は 0 / 最大に丸める', () => {
    expect(scrollFromPointer(0, top, height, max)).toBe(0)
    expect(scrollFromPointer(-500, top, height, max)).toBe(0)
    expect(scrollFromPointer(top + height + 200, top, height, max)).toBe(max)
    expect(scrollFromPointer(1e9, top, height, max)).toBe(max)
  })

  it('メーターの高さが 0 以下・スクロールできないページ・NaN は 0', () => {
    expect(scrollFromPointer(300, top, 0, max)).toBe(0)
    expect(scrollFromPointer(300, top, -10, max)).toBe(0)
    expect(scrollFromPointer(300, top, height, 0)).toBe(0)
    expect(scrollFromPointer(300, top, height, -1)).toBe(0)
    expect(scrollFromPointer(Number.NaN, top, height, max)).toBe(0)
  })

  it('押した位置の進みと、そこへ飛んだ後の進みが往復で一致する', () => {
    const page = 5000
    const vh = 800
    for (const f of [0, 0.1, 0.37, 0.5, 0.92, 1]) {
      const y = scrollFromPointer(top + f * height, top, height, page - vh)
      expect(meterProgress(y, page, vh)).toBeCloseTo(f, 10)
    }
  })
})
