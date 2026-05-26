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
      const duration = readCssVar('--tag-entry-duration', 420)
      const easing = readCssVarRaw('--tag-entry-easing', 'cubic-bezier(0.16, 1, 0.3, 1)')
      const flash = readCssVarRaw('--tag-entry-flash-color', '#28F100')
      const staggerStepMs = readCssVar('--tag-entry-stagger-step', 16)
      const staggerCapMs = readCssVar('--tag-entry-stagger-cap', 400)
      // CRT TV bootup sequence — shutdown の完全逆。
      // 0   : 中央点 (= scale 0.001 + 緑 flash + brightness 30)
      // 0.2 : 横線展開 (= scale 1.3 x 0.02、 緑 flash 弱まる)
      // 0.45: 縦膨らみ (= scale 1 x 1.3、 brightness 1.5)
      // 0.7 : 軽 glitch (= chromatic aberration の RGB shift)
      // 1   : 通常表示 (= 全部 reset)
      return {
        keyframes: [
          {
            offset: 0,
            transform: 'scale(0.001, 0.001)',
            opacity: '1',
            filter: 'brightness(30)',
            background: flash,
            boxShadow: `0 0 12px ${flash}`,
          },
          {
            offset: 0.2,
            transform: 'scale(1.3, 0.02)',
            opacity: '1',
            filter: 'brightness(8) saturate(2)',
            background: flash,
            boxShadow: `0 0 24px ${flash}, 0 0 48px rgba(40, 241, 0, 0.6)`,
          },
          {
            offset: 0.45,
            transform: 'scale(1, 1.3)',
            opacity: '1',
            filter: 'brightness(1.5)',
            background: '#1f3a1f',
            boxShadow: '0 0 8px rgba(40, 241, 0, 0.4)',
          },
          {
            offset: 0.7,
            transform: 'translate(-2px, 1px) scale(1, 1)',
            opacity: '0.95',
            filter: 'brightness(1.1)',
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
