// lib/marketing/lp/grid-ticks.ts
// 背景の縦線の目盛り(BackgroundGrid の .rtk)を流すための純関数。スクロール量 → 目盛りの動き。

/** 目盛りの間隔(px)。BackgroundGrid.module.css の repeating-linear-gradient と同じ値。 */
export const TICK_GAP = 96
/** スクロール量に掛ける倍率。 */
export const TICK_GAIN = 1.0
/** 1 フレームの動きの上限(間隔 × 0.4)。 */
export const TICK_MAX_STEP = TICK_GAP * 0.4

/** 1 フレームぶんの目盛りの動き(px)。ΔY × TICK_GAIN を ±38.4 に制限する(戻せば逆向き)。 */
export function tickStep(dY: number): number {
  return Math.max(-TICK_MAX_STEP, Math.min(TICK_MAX_STEP, dY * TICK_GAIN))
}

/** 目盛りの位置を 0 以上 間隔 未満に巻き戻す(負の向きも)。 */
export function tickWrap(pos: number): number {
  return ((pos % TICK_GAP) + TICK_GAP) % TICK_GAP
}
