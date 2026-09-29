// lib/marketing/lp/rail.ts
//
// 進み具合の線(あみだくじ)・背景の縦線の傾き・流れる目盛りの「計算だけ」。DOM には一切触らない。
// 見本 docs/private/lp-v11-mock.html 861〜961 行の tiltAt / qOf / 渡りの区間 を純関数にしたもの。
// 見本から変えた点:
//   - 傾きは独立した予定ではなく、各「渡り」と同期して左右交互に(渡りが右なら +A の「\」、左なら −A の「/」)。
//     締めの固定が終わったら 0.5H かけて縦(0°)に戻す。
//   - 進み q = 1 は「画面が全部黒になる位置」(締めの上端)。そこで先端が画面の下端(高さ H ちょうど)に届く。
//     その先 0.6H の間、線は下へ抜けて消える(railClear)。
//   - 最後の渡り⑤の着く先 k は、終わりの瞬間に先端が画面内(下端で x ≥ 24px)に見えるよう、画面に合わせて補正する
//     (railFinalStop)。道順の既定値は「希望」。
//   - 流れる目盛りは S の 3 倍。速いスクロールで逆回転に見えないよう、1 フレームの動きを ±(間隔 × 0.4) に制限して足し込む。
// すべて「なめらかなスクロール値 S」だけで決まる(戻せば戻る)。入力は測った数値の plain object。

import { E, clamp01 } from './motion-math'

/** 走る縦線の番号 k(0〜12)の、道順の既定値(希望)。hero → problem → features(01-02 / 03-04 / 05-06)→ 締め の 6 本。左右交互(①左 ②右 ③左 ④右 ⑤左)。最後の k は画面に合わせて補正される。 */
export const RAIL_COLS_WIDE: readonly number[] = [5, 3, 5, 2, 4, 1]
/** 狭い画面(〜980px)の道順の既定値(希望)。 */
export const RAIL_COLS_NARROW: readonly number[] = [6, 4, 7, 5, 8, 3]
/** 傾きの角度(度)。広い画面(981px〜)と狭い画面(〜980px)。 */
export const RAIL_ANGLE_WIDE = 26
export const RAIL_ANGLE_NARROW = 20
/** この幅(px)以下を狭い画面とみなす(LP 全体の CSS の切り替えと同じ 980px)。 */
export const RAIL_NARROW_MAX_VW = 980
/** 渡った先の札(全言語共通の英語の定数)。渡り ①〜⑤ の順。 */
export const RAIL_LABELS = ['PROBLEM', 'FEATURES', '03 LIVE', '05 PRIVACY', 'START'] as const

/** 終わりの瞬間(進み 1)、先端の下端の x(画面の左端から。px)がこの値以上になるように、最後の着く先を補正する。 */
export const RAIL_END_MIN_X = 24

/** 目盛りの間隔(px)。 */
export const RAIL_TICK_GAP = 96
/** 目盛りが流れる量 = ΔS の何倍か。 */
export const RAIL_TICK_GAIN = 3
/** 1 フレームに流してよい量(px)= 間隔の 0.4 倍。半周期(0.5 倍)未満なので、速くても逆回転(ストロボ)に見えない。 */
export const RAIL_TICK_MAX_STEP = RAIL_TICK_GAP * 0.4

/** 締めの固定が終わってから、傾きを 0° へ戻し終えるまでの長さ(× 画面の高さ H)。 */
const TILT_BACK_SPAN = 0.5
/** 進み 1 のあと、線が下へ抜けて消え終えるまでの長さ(× H)。 */
const CLEAR_SPAN = 0.6
/** 度 → ラジアン。 */
const RAD = Math.PI / 180

/**
 * Features の固定区間の進み progress(0..1)と、段(0〜6)の対応。feature-timeline.ts の
 * featTarget(progress) = clamp(progress × 6.6 − 0.2, 0, 6) と同じ値(段 k の境目 = (k + 0.2) / 6.6)。
 */
const FEAT_SPAN_UNITS = 6.6
const FEAT_SHIFT = 0.2

/** 測った数値(すべて px。位置は文書の上・画面の左からの値)。DOM を測るのは呼び出し側で、ここは計算だけ。 */
export type RailMeasure = {
  /** 画面の高さ(window.innerHeight)。 */
  H: number
  /** 線の入れ物(position:fixed; inset:0)の高さ。先端が進み 1 で届く下端で、skew の軸は boxH / 2。ふつうは H と同じ。 */
  boxH: number
  /** 画面の幅が 980px 以下か(道順と角度が変わる)。 */
  narrow: boolean
  /** 背景の縦線の入れ物(.wrap)の左端 x と幅。縦線 k の中心 x(railLineX)を出すのに使う。 */
  gridLeft: number
  gridWidth: number
  /** Problem の section の上端。 */
  problemTop: number
  /** Features の固定の入れ物([data-fpin])の上端。 */
  featTop: number
  /** Features の固定区間の長さ(その入れ物の高さ − 画面の高さ)。 */
  featSpan: number
  /** 締めの section の上端 = 進み 1(画面が全部黒になる)の位置。 */
  finTop: number
  /** 締めの固定が終わるスクロール位置(= 締めの上端 + 高さ − 固定される画面の高さ)。傾きを縦に戻し始める。 */
  finPinEnd: number
}

/** 渡り 1 つぶん。縦線 from から縦線 to へ、スクロール量 a〜b の間に横へ走る。 */
export type RailCrossing = {
  /** 渡りが始まる S。 */
  a: number
  /** 渡りが終わる S。 */
  b: number
  /** 渡りの長さ(b − a)。この間は縦に伸びない。 */
  len: number
  /** 着く縦線が右なら 1(傾き +A の「\」)、左なら −1(−A の「/」)。 */
  dir: 1 | -1
  /** 出発の縦線の番号 k。 */
  from: number
  /** 着く縦線の番号 k(最後の渡り⑤は画面に合わせて補正済み)。 */
  to: number
  /** この渡りが終わった時の傾き(度・符号つき)= dir × A。⑤だけ、どうしても収まらない画面で A より浅くなる。 */
  tilt: number
}

/** 計画(測った数値から 1 回だけ作り、毎フレームの計算に使い回す)。 */
export type RailPlan = {
  H: number
  /** 傾きの角度 A(度)。⑤だけ浅くなることがある(RailCrossing.tilt)。 */
  angle: number
  /** 実際に使う道順(6 本)。最後の k は railFinalStop で補正済み。 */
  cols: readonly number[]
  /** 渡り ①〜⑤(S の順に並び、重ならない)。 */
  crossings: readonly RailCrossing[]
  /** 進み 1 になる S(締めの上端)。 */
  end: number
  /** 進みの分母 = end − 渡りの長さの合計。 */
  den: number
  /** 傾きを 0° へ戻し始める S / 戻し終える S。 */
  tiltBackA: number
  tiltBackB: number
  /** 線が下へ抜けて消え始める S(= end)/ 消え終える S。 */
  clearA: number
  clearB: number
}

/** 道順の既定値(希望・縦線の番号 6 本)。最後の k は buildRailPlan が画面に合わせて補正する。 */
export function railRoute(narrow: boolean): readonly number[] {
  return narrow ? RAIL_COLS_NARROW : RAIL_COLS_WIDE
}

/** 傾きの角度 A(度)。 */
export function railAngle(narrow: boolean): number {
  return narrow ? RAIL_ANGLE_NARROW : RAIL_ANGLE_WIDE
}

/**
 * 縦線 k(0〜12)の中心 x。背景の縦線は 13 本の 1px の線 = 入れ物の左端 + .5 + k × (幅 − 1) / 12(整数に丸める)。
 * 描画(ScrollRail)も計画(railFinalStop)も同じ式を使う。
 */
export function railLineX(k: number, gridLeft: number, gridWidth: number): number {
  return Math.round(gridLeft + 0.5 + (k * (gridWidth - 1)) / 12)
}

/**
 * 最後の渡り⑤の着く先の縦線 k と、その渡りが終わった時の傾きの大きさ(度・正)を、画面に合わせて決める。
 *
 * 終わりの瞬間、先端は画面の下端(y = boxH)にあり、傾き −angle の skewX(軸は画面の縦の真ん中)で
 * x が tan(angle) × boxH / 2 だけ左へずれる。その下端での x が RAIL_END_MIN_X 以上でないと、先端が画面の左外に出る。
 *   1. 希望の k(wish)から、出発の縦線(from)より左のまま右へ 1 本ずつ探し、最初に足りる k を使う(傾きは angle のまま)。
 *   2. どの k でも足りない画面(極端に狭い・高い)は、出発の k − 1 を使い、傾きの大きさを
 *      atan((x − RAIL_END_MIN_X) / (boxH / 2)) まで浅くして、下端での x を RAIL_END_MIN_X に収める。
 * どちらでも to < from(⑤は必ず左向き)。
 */
export function railFinalStop(o: {
  wish: number
  from: number
  angle: number
  gridLeft: number
  gridWidth: number
  boxH: number
}): { to: number; angle: number } {
  const half = o.boxH / 2
  const shift = Math.tan(o.angle * RAD) * half
  for (let k = o.wish; k < o.from; k++) {
    if (railLineX(k, o.gridLeft, o.gridWidth) - shift >= RAIL_END_MIN_X) return { to: k, angle: o.angle }
  }
  const to = Math.max(0, o.from - 1)
  const room = railLineX(to, o.gridLeft, o.gridWidth) - RAIL_END_MIN_X
  const shallow = half > 0 ? Math.atan(Math.max(0, room) / half) / RAD : o.angle
  return { to, angle: Math.min(o.angle, shallow) }
}

/** expo の in-out(見本の eioX)。範囲外は 0 / 1 に丸める。 */
export function eioExpo(t: number): number {
  const x = clamp01(t)
  if (x <= 0) return 0
  if (x >= 1) return 1
  return x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2
}

/**
 * 測った数値から計画を作る。渡りの区間:
 *   ① [Problem の上端 − 0.5H, Problem の上端](0 未満にはしない = いちばん上では必ず縦)
 *   ② [features 固定の上端 − 0.5H, その上端]
 *   ③ ④ features の段の境目(02→03、04→05)の手前 0.5H
 *   ⑤ [締めの上端 − H, 締めの上端 − 0.45H]
 * 道順の最後の k(⑤の着く先)は railFinalStop で補正する。
 * 区間が順番どおりに並ばない・長さが足りないなど、レイアウトが壊れている時は null(呼び出し側は線を出さない)。
 */
export function buildRailPlan(m: RailMeasure): RailPlan | null {
  const { H } = m
  const nums = [H, m.boxH, m.gridLeft, m.gridWidth, m.problemTop, m.featTop, m.featSpan, m.finTop, m.finPinEnd]
  if (!nums.every((n) => Number.isFinite(n)) || H <= 0 || m.boxH <= 0 || m.gridWidth <= 0 || m.featSpan <= 0) return null

  const stepAt = (k: number): number => m.featTop + ((k + FEAT_SHIFT) / FEAT_SPAN_UNITS) * m.featSpan
  const spans: ReadonlyArray<readonly [number, number]> = [
    [Math.max(0, m.problemTop - 0.5 * H), m.problemTop],
    [m.featTop - 0.5 * H, m.featTop],
    [stepAt(2) - 0.5 * H, stepAt(2)],
    [stepAt(4) - 0.5 * H, stepAt(4)],
    [m.finTop - H, m.finTop - 0.45 * H],
  ]

  const angle = railAngle(m.narrow)
  const route = railRoute(m.narrow)
  const stop = railFinalStop({
    wish: route[5],
    from: route[4],
    angle,
    gridLeft: m.gridLeft,
    gridWidth: m.gridWidth,
    boxH: m.boxH,
  })
  const cols = [...route.slice(0, 5), stop.to]

  const crossings: RailCrossing[] = []
  let sumLen = 0
  for (let i = 0; i < spans.length; i++) {
    const [a, b] = spans[i]
    const prevB = i === 0 ? 0 : crossings[i - 1].b
    if (!(b > a) || a < prevB) return null
    const from = cols[i]
    const to = cols[i + 1]
    const dir = to > from ? 1 : -1
    crossings.push({ a, b, len: b - a, dir, from, to, tilt: dir * (i === spans.length - 1 ? stop.angle : angle) })
    sumLen += b - a
  }
  const den = m.finTop - sumLen
  if (!(den > 0)) return null

  return {
    H,
    angle,
    cols,
    crossings,
    end: m.finTop,
    den,
    tiltBackA: m.finPinEnd,
    tiltBackB: m.finPinEnd + TILT_BACK_SPAN * H,
    clearA: m.finTop,
    clearB: m.finTop + CLEAR_SPAN * H,
  }
}

/**
 * 進み q(0→1)。S から「それまでに通った渡り区間の長さ」を引いた値 ÷ 分母。
 * 渡りの間は増えない(縦に伸びず、横へ渡るだけ)。最上部で 0、S = end で 1。
 */
export function railProgress(plan: RailPlan, S: number): number {
  const s = S < 0 ? 0 : S
  let m = s
  for (const c of plan.crossings) m -= Math.min(Math.max(s - c.a, 0), c.len)
  return clamp01(m / plan.den)
}

/**
 * 傾き θ(度)。hero は 0°。渡り i の区間(u = 0→1 の全体)で「前の値」→「渡りの向きの値(右 +A / 左 −A)」へ
 * cubic の in-out で変わる。締めの固定が終わったら 0.5H かけて 0° へ戻る。
 * θ > 0 は skewX で「\」(上が左・下が右)。
 */
export function railTilt(plan: RailPlan, S: number): number {
  let th = 0
  for (const c of plan.crossings) {
    const e = E(S, c.a, c.b)
    th = th * (1 - e) + c.tilt * e
  }
  return th * (1 - E(S, plan.tiltBackA, plan.tiltBackB))
}

/** 今いる縦線(run 0〜5)と、渡りの途中なら渡りの番号(crossing 0〜4、なければ −1)と区間内の進み u。 */
export type RailWhere = { run: number; crossing: number; u: number }

export function railWhere(plan: RailPlan, S: number): RailWhere {
  let run = 0
  for (let i = 0; i < plan.crossings.length; i++) {
    const c = plan.crossings[i]
    if (S > c.b) {
      run = i + 1
      continue
    }
    if (S >= c.a) return { run, crossing: i, u: (S - c.a) / c.len }
    break
  }
  return { run, crossing: -1, u: 0 }
}

/** 渡り c の区間内の進み u(手前は 0、あとは 1)。 */
export function railCrossProgress(c: RailCrossing, S: number): number {
  return S <= c.a ? 0 : S >= c.b ? 1 : (S - c.a) / c.len
}

/**
 * 渡りの区間内の進み uu(0..1)から、横棒の「先端 head」と「しっぽ tail」の位置(0..1)を返す。
 *   0〜.12  予備動作(止まる・角の印)
 *   .12〜.82 横へ走る(head は expo の in-out)
 *   .82〜1  到着(tail が head に追いつく。角の印・スキャン)
 */
export function railCrossPhase(uu: number): { head: number; tail: number } {
  if (uu <= 0) return { head: 0, tail: 0 }
  if (uu >= 1) return { head: 1, tail: 1 }
  return { head: eioExpo((uu - 0.12) / 0.7), tail: uu > 0.82 ? E(uu, 0.82, 1) : 0 }
}

/**
 * 終わりの消える割合(0..1)。end(画面が全部黒になる位置)で 0、end + 0.6H で 1。
 * 入れ物の clip-path: inset(X% 0 0 0) の X = 100 × この値(しっぽが先端を追って画面の下へ出ていく)。
 */
export function railClear(plan: RailPlan, S: number): number {
  return clamp01((S - plan.clearA) / (plan.clearB - plan.clearA))
}

/** 1 フレームぶんの目盛りの動き(px)。ΔS × 3.0 を ±(間隔 × 0.4) に制限する(戻せば逆向き)。 */
export function railTickStep(dS: number): number {
  return Math.max(-RAIL_TICK_MAX_STEP, Math.min(RAIL_TICK_MAX_STEP, dS * RAIL_TICK_GAIN))
}

/** 目盛りの位置を 0 以上 間隔 未満に巻き戻す(負の向きも)。 */
export function railTickWrap(pos: number): number {
  return ((pos % RAIL_TICK_GAP) + RAIL_TICK_GAP) % RAIL_TICK_GAP
}
