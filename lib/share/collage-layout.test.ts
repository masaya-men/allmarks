import { describe, it, expect } from 'vitest'
import { seedCollagePositions, moveElement, resizeElement, resizeElementFromCorner, bringToFront, fitSelectionToScreen } from './collage-layout'

const cards = [
  { id: 'a', width: 200, height: 100 },
  { id: 'b', width: 200, height: 100 },
]

describe('collage-layout', () => {
  it('seedCollagePositions returns a position for every card', () => {
    const pos = seedCollagePositions(cards, 1000, 10)
    expect(Object.keys(pos).sort()).toEqual(['a', 'b'])
    expect(pos.a).toMatchObject({ x: expect.any(Number), y: expect.any(Number), w: 200, h: 100 })
  })

  it('moveElement sets absolute x/y without touching size', () => {
    const pos = seedCollagePositions(cards, 1000, 10)
    const moved = moveElement(pos, 'a', 333, 444)
    expect(moved.a).toMatchObject({ x: 333, y: 444, w: pos.a.w, h: pos.a.h })
    expect(moved.b).toEqual(pos.b)
  })

  it('resizeElement clamps to 80px min and preserves aspect', () => {
    const pos = seedCollagePositions(cards, 1000, 10) // a = 200x100, aspect 2
    const small = resizeElement(pos, 'a', 40)
    expect(small.a.w).toBe(80)
    expect(small.a.h).toBe(40) // 80 / 2
    const big = resizeElement(pos, 'a', 400)
    expect(big.a).toMatchObject({ w: 400, h: 200 })
  })

  it('moveElement / resizeElement are no-ops for unknown id', () => {
    const pos = seedCollagePositions(cards, 1000, 10)
    expect(moveElement(pos, 'zzz', 1, 1)).toBe(pos)
    expect(resizeElement(pos, 'zzz', 100)).toBe(pos)
  })

  it('resizeElementFromCorner keeps the diagonally-opposite corner fixed', () => {
    const pos = { a: { x: 100, y: 100, w: 200, h: 100 } } // aspect 2, BR at (300,200)
    // grab BR → anchor TL: x/y unchanged, grow
    expect(resizeElementFromCorner(pos, 'a', 'br', 400).a).toMatchObject({ x: 100, y: 100, w: 400, h: 200 })
    // grab TL → anchor BR(300,200): new 100x50 → x=300-100=200, y=200-50=150
    expect(resizeElementFromCorner(pos, 'a', 'tl', 100).a).toMatchObject({ x: 200, y: 150, w: 100, h: 50 })
    // grab TR → anchor BL(100,200): x unchanged=100, y=200-50=150
    expect(resizeElementFromCorner(pos, 'a', 'tr', 100).a).toMatchObject({ x: 100, y: 150, w: 100, h: 50 })
    // grab BL → anchor TR(300,100): x=300-100=200, y unchanged=100
    expect(resizeElementFromCorner(pos, 'a', 'bl', 100).a).toMatchObject({ x: 200, y: 100, w: 100, h: 50 })
    // clamps min width, unknown id is a no-op
    expect(resizeElementFromCorner(pos, 'a', 'br', 40).a.w).toBe(80)
    expect(resizeElementFromCorner(pos, 'zzz', 'br', 100)).toBe(pos)
  })

  it('bringToFront moves the id to the end of the order', () => {
    expect(bringToFront(['a', 'b', 'c'], 'a')).toEqual(['b', 'c', 'a'])
    expect(bringToFront(['a', 'b'], 'zzz')).toEqual(['a', 'b'])
  })
})

describe('fitSelectionToScreen', () => {
  const rectBig = { x: 0, y: 0, width: 1000, height: 800 }

  it('空 / 幅ゼロ / 高さゼロ は {} を返す', () => {
    expect(fitSelectionToScreen([], rectBig, 10)).toEqual({})
    expect(fitSelectionToScreen([{ id: 'a', width: 100, height: 100 }], { x: 0, y: 0, width: 0, height: 800 }, 10)).toEqual({})
    expect(fitSelectionToScreen([{ id: 'a', width: 100, height: 100 }], { x: 0, y: 0, width: 1000, height: 0 }, 10)).toEqual({})
  })

  it('全カードに座標を返す', () => {
    const pos = fitSelectionToScreen(
      [{ id: 'a', width: 200, height: 100 }, { id: 'b', width: 200, height: 100 }],
      rectBig,
      10,
    )
    expect(Object.keys(pos).sort()).toEqual(['a', 'b'])
  })

  it('自然サイズで収まるなら縮小しない（w が自然値のまま = 倍率上限1）', () => {
    // 2枚 200x100 は 1000x800 に余裕で収まる → scale 1
    const pos = fitSelectionToScreen(
      [{ id: 'a', width: 200, height: 100 }, { id: 'b', width: 200, height: 100 }],
      rectBig,
      10,
    )
    expect(pos.a.w).toBe(200)
    expect(pos.b.w).toBe(200)
  })

  it('全カードが rect 内に収まる（右端・下端がはみ出さない）', () => {
    const cards = Array.from({ length: 40 }, (_, i) => ({ id: `c${i}`, width: 200, height: 260 }))
    const rect = { x: 24, y: 80, width: 1440, height: 560 }
    const pos = fitSelectionToScreen(cards, rect, 8)
    for (const id in pos) {
      const p = pos[id]
      expect(p.x).toBeGreaterThanOrEqual(rect.x - 0.001)
      expect(p.y).toBeGreaterThanOrEqual(rect.y - 0.001)
      expect(p.x + p.w).toBeLessThanOrEqual(rect.x + rect.width + 0.5)
      expect(p.y + p.h).toBeLessThanOrEqual(rect.y + rect.height + 0.5)
    }
  })

  it('収まらないときは縮小する（少なくとも1枚は自然幅より小さい）', () => {
    const cards = Array.from({ length: 40 }, (_, i) => ({ id: `c${i}`, width: 200, height: 260 }))
    const rect = { x: 0, y: 0, width: 600, height: 400 }
    const pos = fitSelectionToScreen(cards, rect, 8)
    const shrunk = Object.values(pos).some((p) => p.w < 200 - 0.001)
    expect(shrunk).toBe(true)
  })

  it('「収まる中で最大」= 1列に強制した縦積みで倍率が境界に一致する', () => {
    // rect 幅 100・カード幅 100（横に2枚は並ばない）・高さ 100 × 2枚・gap 0。
    // 縮小後も幅 > 50 を保つので 1 列のまま: 自然 totalHeight=200 を rect.height=120 に
    // 収める最大倍率は 0.6 → 各 w≈60・contentH≈120（ぴったり埋める＝最大）。
    const pos = fitSelectionToScreen(
      [{ id: 'a', width: 100, height: 100 }, { id: 'b', width: 100, height: 100 }],
      { x: 0, y: 0, width: 100, height: 120 },
      0,
    )
    expect(Math.abs(pos.a.w - 60)).toBeLessThan(0.5)
    const contentBottom = Math.max(...Object.values(pos).map((p) => p.y + p.h))
    const contentTop = Math.min(...Object.values(pos).map((p) => p.y))
    expect(contentBottom - contentTop).toBeLessThanOrEqual(120.001)
    expect(contentBottom - contentTop).toBeGreaterThan(118) // ほぼ埋めている = 最大
  })

  it('100枚でも全部 rect 内に収まる（80px 下限は無視される）', () => {
    const cards = Array.from({ length: 100 }, (_, i) => ({ id: `c${i}`, width: 267, height: 350 }))
    const rect = { x: 24, y: 80, width: 1440, height: 560 }
    const pos = fitSelectionToScreen(cards, rect, 6)
    expect(Object.keys(pos)).toHaveLength(100)
    for (const id in pos) {
      const p = pos[id]
      expect(p.x + p.w).toBeLessThanOrEqual(rect.x + rect.width + 0.5)
      expect(p.y + p.h).toBeLessThanOrEqual(rect.y + rect.height + 0.5)
    }
  })
})
