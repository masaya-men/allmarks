'use client'
import { useEffect, useState } from 'react'
import type { ThemeId } from '@/lib/board/types'

/** paper bg を content より 0.85x で動かす (= 0.15x ぶん遅れる) ための
 *  translateY 補正量を返す。 paper-atelier 以外 / motion off / reduced-motion
 *  では 0 (= 視差なし、 従来どおり bg は content と 1:1)。 */
export const PAPER_PARALLAX_FACTOR = 0.85
const LAG = 1 - PAPER_PARALLAX_FACTOR // 0.15

export type PaperParallaxInput = {
  readonly themeId: ThemeId
  readonly motionEnabled: boolean
  /** BoardRoot の viewport.y (= 縦スクロール量 px)。 */
  readonly viewportY: number
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** 視差の translateY 補正 (px)。0 = 視差なし。 */
export function usePaperParallax({ themeId, motionEnabled, viewportY }: PaperParallaxInput): number {
  const [reduced, setReduced] = useState(false)
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
  return viewportY * LAG
}
