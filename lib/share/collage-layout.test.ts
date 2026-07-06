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

describe('fitSelectionToScreen (justified rows fill)', () => {
  // 幅=aspect*100, 高さ=100 の均一カードを n 枚。
  const uniform = (n: number, aspect = 1): { id: string; width: number; height: number }[] =>
    Array.from({ length: n }, (_, i) => ({ id: `c${i}`, width: 100 * aspect, height: 100 }))

  it('空 / 幅ゼロ / 高さゼロ は {} を返す', () => {
    expect(fitSelectionToScreen([], { x: 0, y: 0, width: 1000, height: 800 })).toEqual({})
    expect(fitSelectionToScreen(uniform(3), { x: 0, y: 0, width: 0, height: 800 })).toEqual({})
    expect(fitSelectionToScreen(uniform(3), { x: 0, y: 0, width: 1000, height: 0 })).toEqual({})
  })

  it('全カードに座標を返す', () => {
    const pos = fitSelectionToScreen(uniform(2), { x: 0, y: 0, width: 1000, height: 800 })
    expect(Object.keys(pos).sort()).toEqual(['c0', 'c1'])
  })

  it('全カードが rect 内（左上・右端・下端がはみ出さない）', () => {
    const rect = { x: 24, y: 80, width: 1440, height: 560 }
    const pos = fitSelectionToScreen(uniform(40, 0.8), rect)
    for (const id in pos) {
      const p = pos[id]
      expect(p.x).toBeGreaterThanOrEqual(rect.x - 0.5)
      expect(p.y).toBeGreaterThanOrEqual(rect.y - 0.5)
      expect(p.x + p.w).toBeLessThanOrEqual(rect.x + rect.width + 0.5)
      expect(p.y + p.h).toBeLessThanOrEqual(rect.y + rect.height + 0.5)
    }
  })

  it('各カードは入力の縦横比を保つ', () => {
    const cards = [
      { id: 'a', width: 200, height: 100 }, // aspect 2
      { id: 'b', width: 150, height: 300 }, // aspect 0.5
      { id: 'c', width: 120, height: 120 }, // aspect 1
    ]
    const pos = fitSelectionToScreen(cards, { x: 0, y: 0, width: 1000, height: 800 })
    expect(pos.a.w / pos.a.h).toBeCloseTo(2, 3)
    expect(pos.b.w / pos.b.h).toBeCloseTo(0.5, 3)
    expect(pos.c.w / pos.c.h).toBeCloseTo(1, 3)
  })

  it('どのカードも maxCardWidth を超えない（少数でも巨大化しない）', () => {
    const rect = { x: 0, y: 0, width: 2400, height: 900 }
    const pos = fitSelectionToScreen(uniform(3), rect, { maxCardWidth: 268, gapRatio: 0.36 })
    for (const id in pos) expect(pos[id].w).toBeLessThanOrEqual(268 + 0.5)
  })

  it('少数カードは中央に寄る（左上に固まらない・上に張り付かない）', () => {
    const rect = { x: 0, y: 0, width: 2400, height: 900 }
    const pos = fitSelectionToScreen(uniform(3), rect, { maxCardWidth: 268, gapRatio: 0.36 })
    const xs = Object.values(pos)
    const minX = Math.min(...xs.map((p) => p.x))
    const maxX = Math.max(...xs.map((p) => p.x + p.w))
    const leftMargin = minX - rect.x
    const rightMargin = rect.x + rect.width - maxX
    expect(Math.abs(leftMargin - rightMargin)).toBeLessThan(2) // 左右余白ほぼ均等＝水平中央
    const minY = Math.min(...xs.map((p) => p.y))
    expect(minY - rect.y).toBeGreaterThan(50) // 上端に張り付いていない＝垂直中央寄せ
  })

  it('多数の均一カードは矩形の右端・下端まで充填する（bounding box が rect をほぼ埋める）', () => {
    const rect = { x: 24, y: 80, width: 1440, height: 560 }
    const pos = fitSelectionToScreen(uniform(60, 0.8), rect, { maxCardWidth: 268, gapRatio: 0.36 })
    const vals = Object.values(pos)
    const usedW = Math.max(...vals.map((p) => p.x + p.w)) - Math.min(...vals.map((p) => p.x))
    const usedH = Math.max(...vals.map((p) => p.y + p.h)) - Math.min(...vals.map((p) => p.y))
    expect(usedW).toBeGreaterThan(rect.width * 0.95) // 幅は端まで（justified の芯）
    expect(usedH).toBeGreaterThan(rect.height * 0.8) // 高さもほぼ端まで（旧 masonry の 0.77 を明確に超える）
  })

  it('隙間はカード高さに比例する（≈ gapRatio）', () => {
    const rect = { x: 0, y: 0, width: 1000, height: 800 }
    const cards = [
      { id: 'a', width: 100, height: 100 },
      { id: 'b', width: 100, height: 100 },
    ]
    // maxCardWidth を大きく取り上限を無効化 → 2枚は1行に並び幅いっぱいに拡大。
    const pos = fitSelectionToScreen(cards, rect, { maxCardWidth: 5000, gapRatio: 0.3 })
    const gap = pos.b.x - (pos.a.x + pos.a.w)
    expect(gap / pos.a.h).toBeCloseTo(0.3, 1)
  })

  it('非単調な totalHeight でも下端まで埋める（谷にはまらない）', () => {
    // per-row cap × 行分割の離散性で totalHeight(H) は H について非単調。二分探索だと谷に
    // はまり 33% しか埋めなかった敵対的ケース（レビュー指摘）。H スキャン方式は「収まる中で
    // 総高が最大」を選ぶので、achievable な ~99% 充填レイアウトを取りこぼさない。
    const aspects = [4.88, 0.85, 0.56, 2.75, 2.98, 0.83]
    const cards = aspects.map((a, i) => ({ id: `c${i}`, width: a * 100, height: 100 }))
    const rect = { x: 0, y: 0, width: 1396.3, height: 164.9 }
    const pos = fitSelectionToScreen(cards, rect)
    const vals = Object.values(pos)
    for (const p of vals) expect(p.y + p.h).toBeLessThanOrEqual(rect.y + rect.height + 0.5)
    const usedH = Math.max(...vals.map((p) => p.y + p.h)) - Math.min(...vals.map((p) => p.y))
    expect(usedH).toBeGreaterThan(rect.height * 0.9) // 旧二分探索は ~0.33 しか埋めなかった
  })

  it('本番 1489×679 相当（100枚・盤面既定・varied aspect）で safe rect の高さをほぼ埋める', () => {
    // handleEnterArrange と同条件：width=267.84（cardWidthPx）, height=267.84/aspect,
    // rect = 1489×679 に ARRANGE_SAFE_INSET を適用（x64 y104 w1361 h455）, 既定 opts。
    const A = [0.56, 0.75, 1.0, 1.33, 1.5, 1.78, 0.66, 1.0, 0.8, 1.25]
    const cards = Array.from({ length: 100 }, (_, i) => {
      const a = A[i % A.length]
      return { id: `c${i}`, width: 267.84, height: 267.84 / a }
    })
    const rect = { x: 64, y: 104, width: 1361, height: 455 }
    const pos = fitSelectionToScreen(cards, rect)
    const vals = Object.values(pos)
    for (const p of vals) {
      expect(p.x + p.w).toBeLessThanOrEqual(rect.x + rect.width + 0.5)
      expect(p.y + p.h).toBeLessThanOrEqual(rect.y + rect.height + 0.5)
    }
    const usedH = Math.max(...vals.map((p) => p.y + p.h)) - Math.min(...vals.map((p) => p.y))
    const usedW = Math.max(...vals.map((p) => p.x + p.w)) - Math.min(...vals.map((p) => p.x))
    expect(usedW).toBeGreaterThan(rect.width * 0.95)
    expect(usedH).toBeGreaterThan(rect.height * 0.9) // 下端の帯を消す
  })

  it('N-40 回帰：board 実既定比率 × 100枚 × 短く広い rect でも全カード可視サイズ・rect 内（1px 崩壊なし）', () => {
    const CARD_WIDTH_DEFAULT_PX = 267.84
    const GAP_RATIO = 97.21 / 267.84
    const aspects = [0.6, 0.75, 1, 1.33, 1.5, 1.78, 0.5, 2.0]
    const cards = Array.from({ length: 100 }, (_, i) => {
      const ar = aspects[i % aspects.length]
      return { id: `c${i}`, width: CARD_WIDTH_DEFAULT_PX, height: CARD_WIDTH_DEFAULT_PX / ar }
    })
    const rect = { x: 24, y: 80, width: 1489 - 48, height: 679 - 80 - 120 }
    const pos = fitSelectionToScreen(cards, rect, { maxCardWidth: CARD_WIDTH_DEFAULT_PX, gapRatio: GAP_RATIO })
    expect(Object.keys(pos)).toHaveLength(100)
    for (const id in pos) {
      const p = pos[id]
      expect(p.x + p.w).toBeLessThanOrEqual(rect.x + rect.width + 0.5)
      expect(p.y + p.h).toBeLessThanOrEqual(rect.y + rect.height + 0.5)
    }
    const maxW = Math.max(...Object.values(pos).map((p) => p.w))
    expect(maxW).toBeGreaterThan(30)
  })
})
