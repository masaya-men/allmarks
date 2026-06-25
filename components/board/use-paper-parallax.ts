'use client'
import { useEffect, useState } from 'react'
import type { ThemeId } from '@/lib/board/types'

/** paper bg を content より 0.4x で動かす (= cards の 40% 速度で進む = 強い視差)
 *  ための translateY 補正量を返す。 paper-atelier 以外 / motion off /
 *  reduced-motion では 0 (= 視差なし、 従来どおり bg は content と 1:1)。
 *  奥行き順: 固定羊皮紙 0x → bg かすれ染み 0.4x → 中間散乱層 0.5x → カード 1x
 *  (奥ほど遅い = 正しい前後関係)。 */
export const PAPER_PARALLAX_FACTOR = 0.4

export type PaperParallaxInput = {
  readonly themeId: ThemeId
  readonly motionEnabled: boolean
  /** BoardRoot の viewport.y (= 縦スクロール量 px)。 */
  readonly viewportY: number
  /** その層が content に対して動く倍率 (1 = 1:1、 0.85 = 15% 遅れ、 0.7 = 30%
   *  遅れ)。背景=0.85、 中間装飾層=0.7 のように層ごとに変えて奥行きを出す。 */
  readonly factor?: number
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** 視差の translateY 補正 (px)。0 = 視差なし。 */
export function usePaperParallax({ themeId, motionEnabled, viewportY, factor = PAPER_PARALLAX_FACTOR }: PaperParallaxInput): number {
  // 初期値も同期で正しく解決 (reduced-motion 環境でのマウント時 1 回の余分な
  // 再レンダリングを回避; SSR では prefersReducedMotion() が false を返す)。
  const [reduced, setReduced] = useState(prefersReducedMotion)
  // matchMedia を JS で監視 (CSS @media と二重に gate する layer のうちの JS 側)。
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (): void => setReduced(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return (): void => mq.removeEventListener('change', onChange)
  }, [])

  const gatedOff = themeId !== 'paper-atelier' || !motionEnabled || reduced || prefersReducedMotion()
  if (gatedOff) return 0
  return viewportY * (1 - factor)
}
