// lib/share/mobile-band.ts
// スマホの SHARE は「並べる段」を出さない代わりに、選んだカードを画面の縦中央にある
// 1.91:1 の帯へ自動配置し、.outerFrame をまるごと fit:'cover' で撮る。
// normalize-shot.ts の computeCoverRect は中央を切るので、帯が中央にある限り
// 切り出し結果は帯とぴったり一致する（= 黒帯もはみ出しも出ない）。
//
// レプリカ（画面外に組んだ 1200×630 の舞台）を作らないのが肝。背景を作り直すと
// 盤面と共有リンクが食い違う（N-54 型のバグ）を1つ増やすことになる。

import type { CollageFitRect } from './collage-layout'

/** 共有 OG 画像の寸法（X の summary_large_image が期待する 1.91:1）。 */
export const SHARE_OG_ASPECT = { WIDTH: 1200, HEIGHT: 630 } as const

/** 帯の高さ / 帯の幅 = 0.525。 */
const BAND_RATIO = SHARE_OG_ASPECT.HEIGHT / SHARE_OG_ASPECT.WIDTH

/** 撮影倍率の下限（原寸より縮めない）と上限（canvas 爆発の予防）。 */
const MIN_SCALE = 1
const MAX_SCALE = 4

const EMPTY_RECT: CollageFitRect = { x: 0, y: 0, width: 0, height: 0 }

/**
 * スマホの自動配置矩形 ＝ `.outerFrame` の縦中央にある 1.91:1 の帯。
 * 座標系は `.outerFrame`（= CollageCanvas の `.root` が `inset:0` で張る空間）。
 * スマホは `--canvas-margin: 0` なので、これは画面座標と一致する。
 */
export function mobileCollageBandRect(frameW: number, frameH: number): CollageFitRect {
  if (frameW <= 0 || frameH <= 0) return EMPTY_RECT
  const height = Math.min(frameW * BAND_RATIO, frameH)
  return { x: 0, y: (frameH - height) / 2, width: frameW, height }
}

/**
 * 帯の幅がちょうど 1200 raster px になる dom-to-image の `scale`。
 * これを渡さないと 390px 幅の raster を 3.08 倍に引き伸ばすことになり、必ずぼやける。
 */
export function mobileCaptureScale(frameW: number): number {
  if (frameW <= 0) return MIN_SCALE
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, SHARE_OG_ASPECT.WIDTH / frameW))
}
