import { getEntryAnimation } from '@/lib/animation/tag-entry'
import { getShutdownAnimationClass } from '@/lib/animation/tag-shutdown'
import {
  pickScrambleIndices, buildSubsetSchedule, computeSubsetFrame,
} from './glitch-crt'
import styles from './ink-underline.module.css'
import type { TextTransition, PlayEntryArgs } from '../index'

// paper-fade shutdown ('paper-fade' tag-shutdown) と揃える exit 窓。glitch の
// 550ms より少し長く取り、 紙的にゆっくり退場させてから差し替える。
const EXIT_MS = 620
// paper-drift entry が settle するまでの窓。tag-entry('paper-drift') の duration
// より少し長く取り、 静かに着地させる。
const ENTRY_MS = 560
// 訳文の何割の文字を「軽く」スクランブルするか (glitch と同じ控えめ 10%)。
const SCRAMBLE_FRACTION = 0.1

/**
 * paper-atelier 用のテキスト遷移。
 * - loading: 本文下に「インクが引かれていく」 underline (CSS class)。
 * - exit: paper-fade shutdown を流用 (静かに紙が暗転)。
 * - entry: paper-drift boot を流用 + 1 割の軽スクランブルで着地。
 * - reduced-motion / el=null は即 setText(final)。
 */
export function createInkUnderlineTransition(): TextTransition {
  return {
    loadingClass: styles.loading ?? null,
    exitClass: getShutdownAnimationClass('paper-fade') ?? null,
    exitMs: EXIT_MS,
    playEntry({ el, finalText, setText, reducedMotion }: PlayEntryArgs): () => void {
      if (reducedMotion || !el) {
        setText(finalText)
        return () => {}
      }
      // paper-drift boot-up (= ムードボードのタイトル登場と同じ紙の漂い entry)。
      const a = getEntryAnimation('paper-drift')
      if (a) el.animate(a.keyframes, { ...a.options, fill: 'none' })
      // 全文の SCRAMBLE_FRACTION 割だけ軽くスクランブルしながら着地。
      const schedule = buildSubsetSchedule(pickScrambleIndices(finalText, SCRAMBLE_FRACTION), ENTRY_MS)
      let raf = 0
      let cancelled = false
      const start = performance.now()
      const tick = (): void => {
        if (cancelled) return
        const elapsed = performance.now() - start
        if (elapsed >= ENTRY_MS) {
          setText(finalText)
          return
        }
        setText(computeSubsetFrame(finalText, elapsed, schedule))
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
      return (): void => {
        cancelled = true
        if (raf) cancelAnimationFrame(raf)
      }
    },
  }
}
