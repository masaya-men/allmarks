import { pickRandomChar } from '@/lib/board/scramble'
import type { TextTransition, TextTransitionHandle, TextTransitionRunArgs } from '../index'

const STEP_MS = 14       // per-char stagger (= use-idle-scramble burst step)
const BASE_MS = 120
const SPREAD_MS = 80
const GLITCH_MS = 120

/** 各文字が「着地」する経過時刻(ms)の配列。i 番目 = i*STEP + BASE + rand*SPREAD。 */
export function buildSettleSchedule(len: number, rand: () => number = Math.random): number[] {
  const out: number[] = []
  for (let i = 0; i < len; i++) out.push(i * STEP_MS + BASE_MS + rand() * SPREAD_MS)
  return out
}

/** 経過時刻に応じた表示文字列。settled なら target、未 settle はスクランブル文字。
 *  空白は常に空白のまま(幅の揺れ防止)。長さは target と一致。 */
export function computeRevealFrame(target: string, elapsedMs: number, schedule: number[]): string {
  const chars = [...target]
  return chars
    .map((c, i) => {
      if (c === ' ') return ' '
      if (elapsedMs >= (schedule[i] ?? 0)) return c
      return pickRandomChar()
    })
    .join('')
}

function allScrambled(text: string): string {
  return [...text].map((c) => (c === ' ' ? ' ' : pickRandomChar())).join('')
}

export function createScrambleTransition(): TextTransition {
  return {
    run(args: TextTransitionRunArgs): TextTransitionHandle {
      const { onFrame, onGlitch, reducedMotion } = args
      let cancelled = false
      let raf: number | null = null

      // reduced-motion: アニメ無し。toText があれば即着地、無ければ fromText 維持。
      if (reducedMotion) {
        onFrame(args.toText ?? args.fromText)
        return {
          settle: (finalText: string): void => {
            if (cancelled) return
            onFrame(finalText)
          },
          cancel: (): void => { cancelled = true },
        }
      }

      const startReveal = (target: string): void => {
        if (cancelled) return
        const schedule = buildSettleSchedule([...target].length)
        const start = performance.now()
        onGlitch?.(true)
        const glitchTimer = setTimeout(() => { if (!cancelled) onGlitch?.(false) }, GLITCH_MS)
        const tick = (): void => {
          if (cancelled) { clearTimeout(glitchTimer); return }
          const elapsed = performance.now() - start
          onFrame(computeRevealFrame(target, elapsed, schedule))
          if (elapsed < schedule[schedule.length - 1]) {
            raf = requestAnimationFrame(tick)
          } else {
            onFrame(target)
          }
        }
        raf = requestAnimationFrame(tick)
      }

      const loadLoop = (): void => {
        if (cancelled) return
        onFrame(allScrambled(args.fromText))
        raf = requestAnimationFrame(loadLoop)
      }

      if (args.toText !== null) {
        startReveal(args.toText)
      } else {
        loadLoop() // DL/翻訳待ち = スクランブルし続ける(ローダー兼用)
      }

      return {
        settle: (finalText: string): void => {
          if (cancelled) return
          if (raf !== null) { cancelAnimationFrame(raf); raf = null }
          startReveal(finalText)
        },
        cancel: (): void => {
          cancelled = true
          if (raf !== null) { cancelAnimationFrame(raf); raf = null }
        },
      }
    },
  }
}
