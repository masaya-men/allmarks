'use client'
import { useEffect, useState } from 'react'
import type { ThemeId } from '@/lib/board/types'

/** paper bg を content より 0.15x で動かす (= cards の 15% 速度 = ほぼ静止に近い
 *  奥の面) ための translateY 補正量を返す。 paper-atelier 以外 / reduced-motion
 *  では 0 (= 視差なし、 従来どおり bg は content と 1:1)。
 *  奥行き順: 固定羊皮紙 0x → bg かすれ染み 0.15x → 中間散乱層 0.30x → カード 1x
 *  (奥ほど遅い = 正しい前後関係。 散乱層は cards の 30% 速度なので 70% ぶん遅れ
 *  = はっきり視差を感じる)。
 *
 *  NOTE: パララックスは MOTION トグル (= カードの自動再生/スライドショーの ON/OFF)
 *  とは無関係。 視差は「奥行きの見え方」であって「動く演出」ではないので、 MOTION
 *  オフでも常に効く。 唯一 OS の prefers-reduced-motion (アクセシビリティ) のみ尊重。 */
export const PAPER_PARALLAX_FACTOR = 0.15

export type PaperParallaxInput = {
  readonly themeId: ThemeId
  /** BoardRoot の viewport.y (= 縦スクロール量 px)。 */
  readonly viewportY: number
  /** その層が content に対して動く倍率 (1 = 1:1、 0.85 = 15% 遅れ、 0.7 = 30%
   *  遅れ)。背景=0.85、 中間装飾層=0.7 のように層ごとに変えて奥行きを出す。 */
  readonly factor?: number
}

/** 背景レイヤーを視差で動かすテーマ。 paper-atelier = 奥の羊皮紙バックドロップ。
 *  dotted-notebook (Sound Wave) = 模様 (格子など) を乗せたときに背後でゆっくり流れる
 *  = 旧 grid-paper の drift をそのまま引き継ぐ。 既定は無地なので drift は不可視 =
 *  バイト同一。 flat の模様は据え置き (drift なし)。 */
const BG_PARALLAX_THEMES: ReadonlySet<ThemeId> = new Set<ThemeId>(['paper-atelier', 'dotted-notebook'])

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** 視差の translateY 補正 (px)。0 = 視差なし。 paper-atelier と dotted-notebook で有効。
 *  MOTION トグルには依存しない (常時 ON)。 reduced-motion のみ 0 に落とす。 */
export function usePaperParallax({ themeId, viewportY, factor = PAPER_PARALLAX_FACTOR }: PaperParallaxInput): number {
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

  const gatedOff = !BG_PARALLAX_THEMES.has(themeId) || reduced || prefersReducedMotion()
  if (gatedOff) return 0
  return viewportY * (1 - factor)
}
