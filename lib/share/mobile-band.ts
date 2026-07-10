// lib/share/mobile-band.ts
// スマホの SHARE は「並べる段」を出さない代わりに、選んだカードを画面の縦中央にある
// 1.91:1 の帯へ自動配置し、.outerFrame をまるごと fit:'cover' で撮る。
// 帯 = normalize-shot.ts の computeCoverRect が中央から切り出す、ちょうどその
// 1200×630 矩形である。フレームがどんな縦横比でも、帯は常に 1.91:1 を保ち、
// 中央に収まる (フレームより大きくならない)。だから撮影結果は帯とぴったり一致し、
// 黒帯もはみ出しも出ない（= レプリカ舞台の不要）。
//
// フレームが 1.91:1 より横長 → 帯は全高を使い、幅は削られる (左右 cap)。
// フレームが 1.91:1 より縦長 → 帯は全幅を使い、高さは削られる (上下 cap)。

import type { CollageFitRect } from './collage-layout'

/** 共有 OG 画像の寸法（X の summary_large_image が期待する 1.91:1）。 */
export const SHARE_OG_ASPECT = { WIDTH: 1200, HEIGHT: 630 } as const

/** 撮影倍率の下限（原寸より縮めない）と上限（canvas 爆発の予防）。 */
const MIN_SCALE = 1
const MAX_SCALE = 4

const EMPTY_RECT: CollageFitRect = { x: 0, y: 0, width: 0, height: 0 }

/**
 * スマホの自動配置矩形 ＝ `.outerFrame` 内に中央に収まる 1.91:1 の帯。
 * これは computeCoverRect が中央から切り出す、ちょうどその 1200×630 矩形である。
 * 座標系は `.outerFrame`（= CollageCanvas の `.root` が `inset:0` で張る空間）。
 * スマホは `--canvas-margin: 0` なので、これは画面座標と一致する。
 */
export function mobileCollageBandRect(frameW: number, frameH: number): CollageFitRect {
  if (frameW <= 0 || frameH <= 0) return EMPTY_RECT
  // frameW/frameH > 1200/630  ⇔  frameW*630 > frameH*1200 (cross-multiply で誤差回避)
  const frameIsWider = frameW * SHARE_OG_ASPECT.HEIGHT > frameH * SHARE_OG_ASPECT.WIDTH
  if (frameIsWider) {
    // Short & wide: the crop keeps the full height and cuts the sides.
    const width = (frameH * SHARE_OG_ASPECT.WIDTH) / SHARE_OG_ASPECT.HEIGHT
    return { x: (frameW - width) / 2, y: 0, width, height: frameH }
  }
  // Portrait (every phone): the crop keeps the full width and cuts top/bottom.
  const height = (frameW * SHARE_OG_ASPECT.HEIGHT) / SHARE_OG_ASPECT.WIDTH
  return { x: 0, y: (frameH - height) / 2, width: frameW, height }
}

/**
 * 帯の幅がちょうど 1200 raster px になる dom-to-image の `scale`。
 * これを渡さないと 390px 幅の raster を 3.08 倍に引き伸ばすことになり、必ずぼやける。
 */
export function mobileCaptureScale(bandWidth: number): number {
  if (bandWidth <= 0) return MIN_SCALE
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, SHARE_OG_ASPECT.WIDTH / bandWidth))
}
