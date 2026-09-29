// lib/marketing/lp/problem-loop.ts
//
// Problem の右のステージ(一覧 → 1 本の線 → ボード)を、スクロールではなく「時間」で繰り返し再生するための
// 計算だけ。DOM には一切触らない。経過時間(ミリ秒)→ 演出の進み p(0..1。Problem.tsx の renderProb(p) にそのまま
// 渡す)とステージの不透明度。
//
//   一覧で止まる(p = 0)                       1000ms
//   p が 0 → 1 へ進む(時間に対して線形)        3200ms   ← 緩急は renderProb の中の E() がそのまま持つ
//   ボードで止まる(p = 1)                      2600ms
//   ステージを薄くする(p = 1 のまま)            300ms
//   p を 0 に戻して、ステージを濃くする          300ms
//   → 最初へ(合計 7400ms)
//
// 各区間は [始まり, 終わり) の半開区間で、境目の値は次の区間の最初の値。経過時間は 1 周ごとに巻き戻る。

/** 各区間の長さ(ミリ秒)。 */
export const PROBLEM_LOOP = {
  holdList: 1000,
  rise: 3200,
  holdBoard: 2600,
  fadeOut: 300,
  fadeIn: 300,
} as const

/** 1 周の長さ(ミリ秒)。 */
export const PROBLEM_LOOP_CYCLE_MS: number =
  PROBLEM_LOOP.holdList + PROBLEM_LOOP.rise + PROBLEM_LOOP.holdBoard + PROBLEM_LOOP.fadeOut + PROBLEM_LOOP.fadeIn

/** ある瞬間の状態。p は renderProb に渡す進み(0 = 一覧 / 1 = ボード)、opacity はステージ全体の不透明度。 */
export type ProblemLoopFrame = { p: number; opacity: number }

/**
 * 経過時間(ミリ秒。画面に出て再生している間だけ足し込んだ値)→ その時の p と不透明度。
 * 0 未満・NaN・Infinity は最初(一覧・不透明度 1)として扱う。
 */
export function problemLoopAt(elapsedMs: number): ProblemLoopFrame {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return { p: 0, opacity: 1 }
  let t = elapsedMs % PROBLEM_LOOP_CYCLE_MS
  if (t < PROBLEM_LOOP.holdList) return { p: 0, opacity: 1 }
  t -= PROBLEM_LOOP.holdList
  if (t < PROBLEM_LOOP.rise) return { p: t / PROBLEM_LOOP.rise, opacity: 1 }
  t -= PROBLEM_LOOP.rise
  if (t < PROBLEM_LOOP.holdBoard) return { p: 1, opacity: 1 }
  t -= PROBLEM_LOOP.holdBoard
  if (t < PROBLEM_LOOP.fadeOut) return { p: 1, opacity: 1 - t / PROBLEM_LOOP.fadeOut }
  t -= PROBLEM_LOOP.fadeOut
  // 残りは「p を 0 に戻して濃くする」区間(t は 0 以上 fadeIn 未満)。
  return { p: 0, opacity: t / PROBLEM_LOOP.fadeIn }
}
