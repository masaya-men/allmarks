import waveStyles from './themes/wave.module.css'
import paperStyles from './themes/paper.module.css'
import flatStyles from './themes/flat.module.css'

export type SupportedTheme = 'wave' | 'paper-fade' | 'fade'

/**
 * テーマ key を渡すと、 そのテーマの shutdown CSS class 名を返す。
 * - 未対応 theme は undefined (= shutdown アニメ無しのフォールバック、
 *   非該当カードは即座に display:none する等で対応する)。
 * - Phase 3 で他テーマ追加時は themes/{theme}.module.css を足して
 *   このファイルの switch に case 追加するだけ。
 */
export function getShutdownAnimationClass(theme: string): string | undefined {
  switch (theme) {
    case 'wave':
      return waveStyles.shutdown
    case 'paper-fade':
      return paperStyles.fade
    case 'fade':
      return flatStyles.fade
    default:
      return undefined
  }
}
