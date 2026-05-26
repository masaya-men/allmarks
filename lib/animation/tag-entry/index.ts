// WAVE テーマの CSS variables を side-effect で :root に注入するため、
// theme module を 1 つ import する (= shutdown と同じ pattern)。
import './themes/wave.module.css'

export type SupportedTheme = 'wave'

interface EntryAnimation {
  readonly keyframes: Keyframe[]
  readonly options: KeyframeAnimationOptions
  readonly staggerStepMs: number
  readonly staggerCapMs: number
}

function readCssVar(name: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  if (!raw) return fallback
  const ms = parseFloat(raw)
  if (Number.isNaN(ms)) return fallback
  return ms
}

function readCssVarRaw(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return raw || fallback
}

/**
 * テーマ key を渡すと、 そのテーマの carded entry animation 定義を返す。
 * - 未対応 theme は undefined (= entry アニメ無しのフォールバック、
 *   復活カードは即時表示でも UX 上問題にはならない)。
 * - Phase 3 で他テーマ追加時は themes/{theme}.module.css を足して
 *   このファイルの switch に case 追加するだけ。
 *
 * keyframes / options / stagger 数値はテーマ用 CSS variables から読む。
 * テーマ切替は CSS variables の override で済む (= shutdown と同じ思想)。
 */
export function getEntryAnimation(theme: string): EntryAnimation | undefined {
  switch (theme) {
    case 'wave': {
      const duration = readCssVar('--tag-entry-duration', 200)
      const easing = readCssVarRaw('--tag-entry-easing', 'cubic-bezier(0.16, 1, 0.3, 1)')
      const opacityFrom = readCssVar('--tag-entry-opacity-from', 0)
      const scaleFrom = readCssVar('--tag-entry-scale-from', 0.96)
      const staggerStepMs = readCssVar('--tag-entry-stagger-step', 10)
      const staggerCapMs = readCssVar('--tag-entry-stagger-cap', 240)
      return {
        keyframes: [
          { opacity: String(opacityFrom), transform: `scale(${scaleFrom})` },
          { opacity: '1', transform: 'scale(1)' },
        ],
        options: { duration, easing, fill: 'none' },
        staggerStepMs,
        staggerCapMs,
      }
    }
    default:
      return undefined
  }
}
