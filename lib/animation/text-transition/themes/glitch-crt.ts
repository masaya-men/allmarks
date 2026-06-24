import { getEntryAnimation } from '@/lib/animation/tag-entry'
import { getShutdownAnimationClass } from '@/lib/animation/tag-shutdown'
import { pickRandomChar } from '@/lib/board/scramble'
import styles from './glitch-crt.module.css'
import type { TextTransition, PlayEntryArgs } from '../index'

// tag-shutdown の --tag-shutdown-duration (0.55s) と揃える。テキスト差し替えを
// shutdown 完了後に行うためのタイミング基準。
const EXIT_MS = 550
// 訳が「ブートアップ」して 10% スクランブルが落ち着くまでの窓。tag-entry の
// duration (~380ms) より少し長く取り、最後の文字が settle しきる余白を持たせる。
const ENTRY_MS = 520
// 訳文の何割の文字を「軽く」スクランブルするか。全文ではなく一部だけ。
const SCRAMBLE_FRACTION = 0.1

/**
 * 訳文のうちスクランブル対象にする文字 index を fraction 割だけ選ぶ。
 * - 空白は対象外 (幅の揺れ防止)。
 * - rand 注入でテスト決定論化。
 * - 最低 1 文字 (非空白があれば) は選ぶ。
 */
export function pickScrambleIndices(
  text: string,
  fraction: number,
  rand: () => number = Math.random,
): number[] {
  const chars = [...text]
  const candidates: number[] = []
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] !== ' ' && chars[i] !== '\n') candidates.push(i)
  }
  if (candidates.length === 0) return []
  const count = Math.max(1, Math.round(candidates.length * fraction))
  // Fisher–Yates の部分シャッフルで count 個を選ぶ (rand 注入)。
  const pool = candidates.slice()
  for (let i = 0; i < count && i < pool.length; i++) {
    const j = i + Math.floor(rand() * (pool.length - i))
    const tmp = pool[i]
    pool[i] = pool[j]
    pool[j] = tmp
  }
  return pool.slice(0, count).sort((a, b) => a - b)
}

/**
 * index→settle 時刻(ms) の対応。各対象 index は windowMs 内のばらけた時刻に着地する。
 */
export function buildSubsetSchedule(
  indices: readonly number[],
  windowMs: number,
  rand: () => number = Math.random,
): Map<number, number> {
  const m = new Map<number, number>()
  for (const idx of indices) m.set(idx, rand() * windowMs)
  return m
}

/**
 * 経過時刻に応じた表示文字列。schedule にある index で elapsed < settle のものだけ
 * スクランブル文字、それ以外は target のまま。長さ・空白は target と一致。
 */
export function computeSubsetFrame(
  target: string,
  elapsedMs: number,
  schedule: ReadonlyMap<number, number>,
): string {
  const chars = [...target]
  return chars
    .map((c, i) => {
      const settle = schedule.get(i)
      if (settle === undefined) return c
      if (elapsedMs >= settle) return c
      return pickRandomChar()
    })
    .join('')
}

export function createGlitchCrtTransition(): TextTransition {
  return {
    loadingClass: styles.loading ?? null,
    exitClass: getShutdownAnimationClass('wave') ?? null,
    exitMs: EXIT_MS,
    playEntry({ el, finalText, setText, reducedMotion }: PlayEntryArgs): () => void {
      if (reducedMotion || !el) {
        setText(finalText)
        return () => {}
      }
      // CRT boot-up (= ムードボードのタイトル登場と同じ wave entry)。
      const a = getEntryAnimation('wave')
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
