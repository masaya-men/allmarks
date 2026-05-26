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
      const duration = readCssVar('--tag-entry-duration', 380)
      const easing = readCssVarRaw('--tag-entry-easing', 'cubic-bezier(0.0, 0.0, 0.2, 1)')
      const flash = readCssVarRaw('--tag-entry-flash-color', '#28F100')
      const bloomIntensity = readCssVar('--tag-entry-bloom-intensity', 1.6)
      const glitchOffsetPx = readCssVar('--tag-entry-glitch-offset', 2)
      const staggerStepMs = readCssVar('--tag-entry-stagger-step', 14)
      const staggerCapMs = readCssVar('--tag-entry-stagger-cap', 350)
      // CRT TV bootup sequence — 業界本流 (Aldlevine CRT Page Load /
      // Old CRT TV reference / Material / Apple HIG ベース)。
      // shutdown を機械的に reverse しただけだと「最初に強烈、 最後は地味」
      // になり「画面が立ち上がる」 心理と逆方向。 本実装は bloom を最後の
      // 山場 (offset 0.55) に置き、 「だんだん完成する」 演出を実現。
      //
      // 0    : 完全闇 (= scale 0, opacity 0)
      // 0.12 : 中央点出現 (= 緑 flash brightness 30、 sub-100ms 爆発感)
      // 0.28 : 横線最大展開 (= scale 1.3 x 0.02、 shutdown 50% の完全対称)
      // 0.55 : 縦展開 + phosphor bloom 山場 ← 本案の核
      // 0.78 : chromatic aberration glitch (= AllMarks 確定言語)
      // 1.0  : 通常表示 (= 全部 reset)
      return {
        keyframes: [
          {
            offset: 0,
            transform: 'scale(0, 0)',
            opacity: '0',
            filter: 'brightness(1)',
            background: 'transparent',
            boxShadow: 'none',
          },
          {
            offset: 0.12,
            transform: 'scale(0.001, 0.001)',
            opacity: '1',
            filter: 'brightness(30) saturate(2)',
            background: flash,
            boxShadow: `0 0 12px ${flash}`,
          },
          {
            offset: 0.28,
            transform: 'scale(1.3, 0.02)',
            opacity: '1',
            filter: 'brightness(8) saturate(2)',
            background: flash,
            boxShadow: `0 0 24px ${flash}, 0 0 48px rgba(40, 241, 0, 0.6)`,
          },
          {
            offset: 0.55,
            transform: 'scale(1, 1.18)',
            opacity: '1',
            filter: `brightness(${bloomIntensity}) saturate(1.4)`,
            background: 'rgba(40, 241, 0, 0.18)',
            boxShadow: '0 0 16px rgba(40, 241, 0, 0.5)',
          },
          {
            offset: 0.78,
            transform: `translate(${-glitchOffsetPx}px, 1px) scale(1, 1)`,
            opacity: '0.96',
            filter: 'brightness(1.15)',
            background: 'transparent',
            boxShadow: '2px 0 0 #ff3a5a, -2px 0 0 #5aefff',
          },
          {
            offset: 1,
            transform: 'translate(0, 0) scale(1, 1)',
            opacity: '1',
            filter: 'brightness(1)',
            background: 'transparent',
            boxShadow: 'none',
          },
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
