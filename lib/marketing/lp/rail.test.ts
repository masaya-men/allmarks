import { describe, it, expect } from 'vitest'
import {
  RAIL_ANGLE_NARROW,
  RAIL_ANGLE_WIDE,
  RAIL_END_MIN_X,
  RAIL_TICK_GAP,
  RAIL_TICK_MAX_STEP,
  buildRailPlan,
  eioExpo,
  railClear,
  railCrossPhase,
  railCrossProgress,
  railFinalStop,
  railLineX,
  railProgress,
  railRoute,
  railTickStep,
  railTickWrap,
  railTilt,
  railWhere,
  type RailMeasure,
  type RailPlan,
} from './rail'

/** 画面ごとに決まる測定値(画面の高さ・入れ物の高さ・幅の区分・背景の縦線の入れ物の位置と幅)。 */
type Screen = Pick<RailMeasure, 'H' | 'boxH' | 'narrow' | 'gridLeft' | 'gridWidth'>

/**
 * 実機の CSS に合わせた画面: 縦線の入れ物(.wrap)= min(1320, 中身の幅 − 2×gut)、gut = clamp(16, 3.2vw, 44)。
 * 幅 w・高さ h は CSS px、scrollbar は縦スクロールバーの幅(PC は約 17、スマホは 0)。
 */
function screenOf(w: number, h: number, scrollbar: number): Screen {
  const clientW = w - scrollbar
  const gut = Math.min(44, Math.max(16, w * 0.032))
  const gridWidth = Math.min(1320, clientW - 2 * gut)
  return { H: h, boxH: h, narrow: w <= 980, gridLeft: Math.round((clientW - gridWidth) / 2), gridWidth }
}

/**
 * 見本と同じ作りの長いページ(H=700): hero 700 / problem 3.2H / tape+見出し 260 /
 * features は固定区間 6.6×1.12H + 画面 1 枚 / 締めは 2.4H(固定が終わるのは finTop + 1.4H)。
 */
function measure(over: Partial<RailMeasure> = {}): RailMeasure {
  const H = over.H ?? 700
  const problemTop = 700
  const featTop = problemTop + 3.2 * H + 260
  const featSpan = 6.6 * 1.12 * H
  const finTop = featTop + featSpan + H
  return {
    H,
    boxH: H,
    narrow: false,
    gridLeft: 76,
    gridWidth: 1320,
    problemTop,
    featTop,
    featSpan,
    finTop,
    finPinEnd: finTop + 1.4 * H,
    ...over,
  }
}

function planOf(over?: Partial<RailMeasure>): RailPlan {
  const plan = buildRailPlan(measure(over))
  if (!plan) throw new Error('この計測値では線の計画が作れるはず')
  return plan
}

/** 終わりの瞬間(S_end)の、先端の下端の x(画面の左端から)。傾き θ の skewX は画面の縦の真ん中が軸。 */
function endTipX(plan: RailPlan, s: Screen): number {
  const x = railLineX(plan.cols[5], s.gridLeft, s.gridWidth)
  return x + Math.tan((railTilt(plan, plan.end) * Math.PI) / 180) * (s.boxH / 2)
}

/** a〜b を n 等分した S の列(端を含む)。 */
function sweep(a: number, b: number, n: number): number[] {
  return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n)
}

describe('railRoute(道順の既定値 = 希望)', () => {
  it('広い画面は 5→3→5→2→4→1、狭い画面は 6→4→7→5→8→3', () => {
    expect(railRoute(false)).toEqual([5, 3, 5, 2, 4, 1])
    expect(railRoute(true)).toEqual([6, 4, 7, 5, 8, 3])
  })

  it('左・右・左・右・左と交互に渡る(広い画面も狭い画面も)', () => {
    for (const narrow of [false, true]) {
      const cols = railRoute(narrow)
      const dirs = cols.slice(1).map((k, i) => Math.sign(k - cols[i]))
      expect(dirs).toEqual([-1, 1, -1, 1, -1])
      for (const k of cols) {
        expect(k).toBeGreaterThanOrEqual(0)
        expect(k).toBeLessThanOrEqual(12)
      }
    }
  })
})

describe('buildRailPlan(渡りの区間)', () => {
  it('角度は広い画面 26° / 狭い画面 20°', () => {
    expect(planOf().angle).toBe(RAIL_ANGLE_WIDE)
    expect(RAIL_ANGLE_WIDE).toBe(26)
    expect(planOf(screenOf(390, 844, 0)).angle).toBe(RAIL_ANGLE_NARROW)
    expect(RAIL_ANGLE_NARROW).toBe(20)
  })

  it('渡りは 5 つ、向きは左右交互、区間は順番どおりで重ならない', () => {
    const plan = planOf()
    expect(plan.crossings.map((c) => c.dir)).toEqual([-1, 1, -1, 1, -1])
    plan.crossings.forEach((c, i) => {
      expect(c.b).toBeGreaterThan(c.a)
      expect(c.len).toBeCloseTo(c.b - c.a)
      if (i > 0) expect(c.a).toBeGreaterThanOrEqual(plan.crossings[i - 1].b)
    })
  })

  it('渡り⑤は [締めの上端 − H, 締めの上端 − 0.45H]、終点(進み 1)は締めの上端', () => {
    const m = measure()
    const plan = planOf()
    const last = plan.crossings[4]
    expect(last.a).toBeCloseTo(m.finTop - m.H)
    expect(last.b).toBeCloseTo(m.finTop - 0.45 * m.H)
    expect(plan.end).toBe(m.finTop)
  })

  it('計測値が壊れている時は null(線を出さない)', () => {
    expect(buildRailPlan(measure({ H: 0 }))).toBeNull()
    expect(buildRailPlan(measure({ boxH: 0 }))).toBeNull()
    expect(buildRailPlan(measure({ gridWidth: 0 }))).toBeNull()
    expect(buildRailPlan(measure({ gridLeft: Number.NaN }))).toBeNull()
    expect(buildRailPlan(measure({ problemTop: Number.NaN }))).toBeNull()
    expect(buildRailPlan(measure({ featSpan: -10 }))).toBeNull()
    // 締めが features の途中にめり込んでいて、渡りの区間が順番どおりにならない
    expect(buildRailPlan(measure({ finTop: 4000 }))).toBeNull()
  })
})

describe('railFinalStop(最後の着く先の補正)', () => {
  const SCREENS: ReadonlyArray<readonly [string, number, number, number]> = [
    ['1489×679(PC・本人の画面)', 1489, 679, 17],
    ['1440×780(ノート PC)', 1440, 780, 17],
    ['390×844(スマホ縦)', 390, 844, 0],
    ['390×664(スマホ縦・ブラウザの帯あり)', 390, 664, 0],
  ]

  it.each(SCREENS)('%s: S_end の先端の下端の x が 24px 以上で、⑤ は左向き', (_name, w, h, sb) => {
    const s = screenOf(w, h, sb)
    const plan = planOf(s)
    const last = plan.crossings[4]
    expect(last.dir).toBe(-1)
    expect(last.to).toBeLessThan(last.from)
    expect(plan.cols[5]).toBe(last.to)
    expect(RAIL_END_MIN_X).toBe(24)
    expect(endTipX(plan, s)).toBeGreaterThanOrEqual(RAIL_END_MIN_X - 1e-6)
    // 渡り全体の左右交互は崩れない
    expect(plan.crossings.map((c) => c.dir)).toEqual([-1, 1, -1, 1, -1])
  })

  it('希望の k(広い 1 / 狭い 3)が足りない画面では、出発より左のまま、右へ 1 本ずつ探して最初に足りる k(傾きは A のまま)', () => {
    // 1489×679: k=1 は下端で x≈20px(足りない)→ k=2
    const pc = planOf(screenOf(1489, 679, 17))
    expect(pc.cols).toEqual([5, 3, 5, 2, 4, 2])
    expect(pc.crossings[4].tilt).toBeCloseTo(-RAIL_ANGLE_WIDE, 10)
    // 390×844: k=3,4,5 は足りず k=6。390×664: k=3,4 は足りず k=5
    expect(planOf(screenOf(390, 844, 0)).cols).toEqual([6, 4, 7, 5, 8, 6])
    expect(planOf(screenOf(390, 664, 0)).cols).toEqual([6, 4, 7, 5, 8, 5])
  })

  it('希望の k が収まる大きい画面では、道順の既定値のまま(傾きも A のまま)', () => {
    const s = screenOf(2560, 1300, 17)
    const plan = planOf(s)
    expect(plan.cols).toEqual([5, 3, 5, 2, 4, 1])
    expect(plan.crossings[4].tilt).toBeCloseTo(-RAIL_ANGLE_WIDE, 10)
    expect(endTipX(plan, s)).toBeGreaterThanOrEqual(RAIL_END_MIN_X)
  })

  it('どの k でも足りない画面(極端に狭い・高い)は、出発の k − 1 で、傾きを浅くして下端の x をちょうど 24px に収める', () => {
    for (const [w, h, sb] of [
      [320, 1200, 0],
      [1000, 1500, 17],
    ] as const) {
      const s = screenOf(w, h, sb)
      const plan = planOf(s)
      const last = plan.crossings[4]
      expect(last.to).toBe(last.from - 1)
      expect(last.dir).toBe(-1)
      expect(Math.abs(last.tilt)).toBeGreaterThan(0)
      expect(Math.abs(last.tilt)).toBeLessThan(plan.angle)
      expect(endTipX(plan, s)).toBeCloseTo(RAIL_END_MIN_X, 6)
    }
  })

  it('k − 1 の縦線そのものが 24px に届かない画面では、傾きを 0° まで浅くする(それでも左向き)', () => {
    const stop = railFinalStop({ wish: 1, from: 2, angle: 26, gridLeft: 0, gridWidth: 120, boxH: 800 })
    expect(stop).toEqual({ to: 1, angle: 0 })
  })

  it('直接呼んでも同じ規則(1489×679 は 1 → 2、傾きは 26° のまま)', () => {
    const s = screenOf(1489, 679, 17)
    expect(railFinalStop({ wish: 1, from: 4, angle: 26, gridLeft: s.gridLeft, gridWidth: s.gridWidth, boxH: s.boxH })).toEqual({
      to: 2,
      angle: 26,
    })
  })

  it('幅・高さをいろいろ振っても、S_end の先端の下端の x は 24px 以上で、⑤ は左向き', () => {
    const widths = [320, 360, 390, 414, 600, 768, 980, 981, 1024, 1280, 1366, 1440, 1489, 1920, 2560]
    const heights = [400, 568, 664, 700, 844, 900, 1080, 1300, 1600, 2000]
    for (const w of widths) {
      for (const h of heights) {
        const s = screenOf(w, h, w <= 600 ? 0 : 17)
        const plan = planOf(s)
        const last = plan.crossings[4]
        expect(last.dir, `${w}×${h}`).toBe(-1)
        expect(last.to, `${w}×${h}`).toBeLessThan(last.from)
        expect(Math.abs(last.tilt), `${w}×${h}`).toBeLessThanOrEqual(plan.angle + 1e-9)
        expect(endTipX(plan, s), `${w}×${h}`).toBeGreaterThanOrEqual(RAIL_END_MIN_X - 1e-6)
      }
    }
  })

  it('railLineX は 13 本の縦線の中心 x(左端 + .5 + k × (幅 − 1) / 12 を丸める)', () => {
    expect(railLineX(0, 76, 1320)).toBe(77)
    expect(railLineX(12, 76, 1320)).toBe(Math.round(76.5 + 1319))
    expect(railLineX(1, 76, 1320)).toBe(186)
    expect(railLineX(6, 16, 358)).toBe(195)
  })
})

describe('railProgress(進み q)', () => {
  it('いちばん上で 0、S_end で 1、その先も 1', () => {
    const plan = planOf()
    expect(railProgress(plan, 0)).toBe(0)
    expect(railProgress(plan, -50)).toBe(0)
    expect(railProgress(plan, plan.end)).toBeCloseTo(1, 10)
    expect(railProgress(plan, plan.end + 500)).toBe(1)
  })

  it('背が高い画面(hero が 0.5H より短い)でも、いちばん上では 0 と縦', () => {
    const plan = planOf({ H: 1920, problemTop: 850 })
    expect(plan.crossings[0].a).toBeGreaterThanOrEqual(0)
    expect(railProgress(plan, 0)).toBe(0)
    expect(Math.abs(railTilt(plan, 0))).toBeCloseTo(0, 10)
  })

  it('単調増加(戻らない)で、全体では確かに伸びる', () => {
    const plan = planOf()
    const qs = sweep(0, plan.end + 300, 4000).map((s) => railProgress(plan, s))
    for (let i = 1; i < qs.length; i++) expect(qs[i]).toBeGreaterThanOrEqual(qs[i - 1])
    expect(qs[qs.length - 1]).toBeGreaterThan(qs[0])
  })

  it('渡りの区間の間は q が増えない', () => {
    const plan = planOf()
    for (const c of plan.crossings) {
      const q0 = railProgress(plan, c.a)
      for (const s of sweep(c.a, c.b, 20)) expect(railProgress(plan, s)).toBeCloseTo(q0, 10)
      // 区間を出たらまた伸びる
      expect(railProgress(plan, c.b + 40)).toBeGreaterThan(q0)
    }
  })
})

describe('railTilt(傾き θ)', () => {
  it('最上部で 0°', () => {
    expect(Math.abs(railTilt(planOf(), 0))).toBeCloseTo(0, 10)
    expect(Math.abs(railTilt(planOf(screenOf(390, 844, 0)), 0))).toBeCloseTo(0, 10)
  })

  it('各渡りのあとの θ の符号は渡りの向きと同じ(右 = +、左 = −)で、大きさは A(⑤だけ収まらない画面で浅くなる)', () => {
    for (const s of [screenOf(1489, 679, 17), screenOf(390, 844, 0), screenOf(1440, 780, 17)]) {
      const plan = planOf(s)
      plan.crossings.forEach((c, i) => {
        const nextA = i < 4 ? plan.crossings[i + 1].a : plan.tiltBackA
        const after = railTilt(plan, c.b)
        const later = railTilt(plan, (c.b + nextA) / 2)
        expect(Math.sign(after)).toBe(c.dir)
        expect(Math.sign(later)).toBe(c.dir)
        expect(after).toBeCloseTo(c.tilt, 10)
        expect(later).toBeCloseTo(c.tilt, 10)
        expect(Math.abs(c.tilt)).toBeCloseTo(plan.angle, 10)
      })
    }
  })

  it('渡りの区間の中では「前の値」から「渡りの向きの値」へなめらかに一方向に変わる', () => {
    const plan = planOf()
    plan.crossings.forEach((c, i) => {
      const before = i === 0 ? 0 : plan.crossings[i - 1].tilt
      const target = c.tilt
      expect(railTilt(plan, c.a)).toBeCloseTo(before, 10)
      expect(railTilt(plan, (c.a + c.b) / 2)).toBeCloseTo((before + target) / 2, 10)
      const ths = sweep(c.a, c.b, 40).map((s) => railTilt(plan, s))
      for (let k = 1; k < ths.length; k++) {
        if (target > before) expect(ths[k]).toBeGreaterThanOrEqual(ths[k - 1] - 1e-9)
        else expect(ths[k]).toBeLessThanOrEqual(ths[k - 1] + 1e-9)
      }
    })
  })

  it('浅くなった⑤(収まらない画面)でも、前の値 +A から −(浅い角度)へ渡り、その角度のまま固定が終わる', () => {
    const plan = planOf(screenOf(320, 1200, 0))
    const last = plan.crossings[4]
    expect(Math.abs(last.tilt)).toBeLessThan(plan.angle)
    expect(railTilt(plan, last.a)).toBeCloseTo(plan.crossings[3].tilt, 10)
    expect(railTilt(plan, plan.end)).toBeCloseTo(last.tilt, 10)
    expect(railTilt(plan, plan.tiltBackA)).toBeCloseTo(last.tilt, 10)
    expect(Math.abs(railTilt(plan, plan.tiltBackB))).toBeCloseTo(0, 10)
  })

  it('締めの固定が終わったあと、0.5H かけて縦(0°)に戻り、その先はずっと 0°', () => {
    const m = measure()
    const plan = planOf()
    const lastTilt = plan.crossings[4].tilt
    expect(plan.tiltBackA).toBe(m.finPinEnd)
    expect(plan.tiltBackB).toBeCloseTo(m.finPinEnd + 0.5 * m.H)
    expect(railTilt(plan, m.finPinEnd)).toBeCloseTo(lastTilt, 10) // 渡り⑤は左 → −A のまま固定終了
    const mid = railTilt(plan, m.finPinEnd + 0.25 * m.H)
    expect(mid).toBeCloseTo(lastTilt / 2, 10)
    expect(Math.abs(railTilt(plan, plan.tiltBackB))).toBeCloseTo(0, 10)
    expect(Math.abs(railTilt(plan, plan.tiltBackB + 1000))).toBeCloseTo(0, 10)
  })
})

describe('railClear(終わりの消える割合)', () => {
  it('S_end で 0、S_end + 0.6H で 1、その手前は 0・その先は 1', () => {
    const m = measure()
    const plan = planOf()
    expect(railClear(plan, 0)).toBe(0)
    expect(railClear(plan, plan.end - 100)).toBe(0)
    expect(railClear(plan, plan.end)).toBe(0)
    expect(railClear(plan, plan.end + 0.6 * m.H)).toBe(1)
    expect(railClear(plan, plan.end + 5000)).toBe(1)
  })

  it('途中は 0 と 1 の間で、進むほど増える(戻せば戻る)', () => {
    const m = measure()
    const plan = planOf()
    const cs = sweep(plan.end, plan.end + 0.6 * m.H, 30).map((s) => railClear(plan, s))
    for (let i = 1; i < cs.length; i++) expect(cs[i]).toBeGreaterThanOrEqual(cs[i - 1])
    expect(railClear(plan, plan.end + 0.3 * m.H)).toBeCloseTo(0.5, 10)
  })
})

describe('railWhere / railCrossProgress / railCrossPhase', () => {
  it('今いる縦線(run)と、渡りの途中(crossing, u)を返す', () => {
    const plan = planOf()
    expect(railWhere(plan, 0)).toEqual({ run: 0, crossing: -1, u: 0 })
    const c0 = plan.crossings[0]
    const w = railWhere(plan, (c0.a + c0.b) / 2)
    expect(w.run).toBe(0)
    expect(w.crossing).toBe(0)
    expect(w.u).toBeCloseTo(0.5)
    const c4 = plan.crossings[4]
    expect(railWhere(plan, c4.b + 1)).toEqual({ run: 5, crossing: -1, u: 0 })
    expect(railWhere(plan, (plan.crossings[1].b + plan.crossings[2].a) / 2).run).toBe(2)
  })

  it('区間の進み u: 手前は 0、あとは 1、中は線形', () => {
    const c = planOf().crossings[2]
    expect(railCrossProgress(c, c.a - 10)).toBe(0)
    expect(railCrossProgress(c, c.b + 10)).toBe(1)
    expect(railCrossProgress(c, (c.a + c.b) / 2)).toBeCloseTo(0.5)
  })

  it('渡りの進み: 0〜.12 予備動作 / .12〜.82 横移動(expo in-out)/ .82〜1 到着', () => {
    expect(railCrossPhase(0)).toEqual({ head: 0, tail: 0 })
    expect(railCrossPhase(1)).toEqual({ head: 1, tail: 1 })
    expect(railCrossPhase(0.12)).toEqual({ head: 0, tail: 0 })
    expect(railCrossPhase(0.47).head).toBeCloseTo(0.5, 10) // (.47 − .12)/.7 = .5 → expo in-out の真ん中
    expect(railCrossPhase(0.47).tail).toBe(0)
    expect(railCrossPhase(0.82).head).toBe(1)
    expect(railCrossPhase(0.82).tail).toBe(0)
    expect(railCrossPhase(0.91).tail).toBeCloseTo(0.5, 10)
  })

  it('eioExpo は 0 / .5 / 1 で、範囲外は丸められ、単調増加', () => {
    expect(eioExpo(-1)).toBe(0)
    expect(eioExpo(0)).toBe(0)
    expect(eioExpo(0.5)).toBeCloseTo(0.5, 10)
    expect(eioExpo(1)).toBe(1)
    expect(eioExpo(2)).toBe(1)
    const v = sweep(0, 1, 50).map(eioExpo)
    for (let i = 1; i < v.length; i++) expect(v[i]).toBeGreaterThanOrEqual(v[i - 1])
  })
})

describe('流れる目盛り(ΔS × 3.0 を ±(間隔 × 0.4) に制限して足し込む)', () => {
  it('間隔 96px・1 フレームの上限は 38.4px', () => {
    expect(RAIL_TICK_GAP).toBe(96)
    expect(RAIL_TICK_MAX_STEP).toBeCloseTo(38.4, 10)
  })

  it('小さい ΔS は 3 倍で流れ、戻せば逆向きに流れる', () => {
    expect(railTickStep(4)).toBeCloseTo(12, 10)
    expect(railTickStep(-4)).toBeCloseTo(-12, 10)
    expect(railTickStep(0)).toBe(0)
  })

  it('速いスクロールでも 1 フレームの動きは ±38.4px までで、半周期(48px)を超えない(逆回転に見えない)', () => {
    expect(railTickStep(1000)).toBeCloseTo(38.4, 10)
    expect(railTickStep(-1000)).toBeCloseTo(-38.4, 10)
    expect(RAIL_TICK_MAX_STEP).toBeLessThan(RAIL_TICK_GAP / 2)
  })

  it('位置は 0 以上 96 未満に巻き戻す(負の向きも)', () => {
    expect(railTickWrap(0)).toBe(0)
    expect(railTickWrap(96)).toBe(0)
    expect(railTickWrap(100)).toBeCloseTo(4, 10)
    expect(railTickWrap(-10)).toBeCloseTo(86, 10)
    expect(railTickWrap(-96)).toBe(0)
  })
})
