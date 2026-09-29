// lib/marketing/lp/page-scroll-meter.ts
//
// LP の右端のスクロールメーター(PageScrollMeter)の「計算だけ」。DOM には一切触らない。
// 入力は測った数値(px)で、測るのは呼び出し側(レイアウト時・リサイズ時・フォント読み込み後・load 時だけ)。
// ボード画面の音の波形の ScrollMeter(components/board/ScrollMeter.tsx)とは無関係。

import { clamp01 } from './motion-math'

/**
 * 進み(0..1)= scrollY ÷ (ページの高さ − 画面の高さ)。
 * 範囲外(iOS / macOS のはね返りで負や最大超え)は 0..1 に丸める。動けないページ(高さ ≤ 画面)・NaN は 0。
 */
export function meterProgress(scrollY: number, pageHeight: number, viewportHeight: number): number {
  const range = pageHeight - viewportHeight
  if (!(range > 0) || !Number.isFinite(scrollY)) return 0
  return clamp01(scrollY / range)
}

/**
 * 区切りの目盛りの位置(0..1、メーターの上端から)。その区画の上端が画面の上端に来るスクロール位置の「進み」。
 * つまり線の先端がこの目盛りに届いた瞬間 = その区画が画面の頭に来た瞬間。ページの最後の方の区画は、画面の頭まで
 * 上がれない(スクロールの最大値が先に来る)ことがあるので、その場合は 1(メーターの下端)に丸める。
 * sectionTop はページの上端からの距離(getBoundingClientRect().top + scrollY)。
 */
export function meterTickAt(sectionTop: number, pageHeight: number, viewportHeight: number): number {
  return meterProgress(sectionTop, pageHeight, viewportHeight)
}

/**
 * 当たり判定の縦の位置(画面上の clientY)→ スクロール位置(px)。
 * メーターの上端(trackTop)で 0、下端(trackTop + trackHeight)で maxScroll。範囲外は端に丸める。
 * メーターの高さが 0 以下・スクロールできないページ・NaN は 0。
 */
export function scrollFromPointer(pointerY: number, trackTop: number, trackHeight: number, maxScroll: number): number {
  if (!(trackHeight > 0) || !(maxScroll > 0) || !Number.isFinite(pointerY)) return 0
  return clamp01((pointerY - trackTop) / trackHeight) * maxScroll
}
