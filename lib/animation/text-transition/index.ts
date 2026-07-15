import { createGlitchCrtTransition } from './themes/glitch-crt'
import { createInkUnderlineTransition } from './themes/ink-underline'
import { createQuietTransition } from './themes/quiet'

/**
 * 1 つの「本文テキスト遷移」テーマの記述子。
 *
 * 遷移は要素ベース: controller (= useTweetTranslation) が phase を進め、
 *  - loading 中: 本文要素に loadingClass を付ける (= 間欠グリッチ「じじっ」)
 *  - exit: exitClass を付けて exitMs 待つ (= CRT shutdown「ぶつん」)
 *  - text 差し替え後: playEntry() で boot-up を流し、entryMs の間に
 *    scrambleFraction 割の文字を軽くスクランブルして settle
 *
 * テーマ切替は getTextTransition(theme) の case 追加だけ (= tag-entry /
 * tag-shutdown と同じ思想)。CSS クラスは declarative に React が付け外し、
 * boot-up だけ playEntry() で imperative に流す (WAAPI は className と競合しない)。
 */
export type PlayEntryArgs = {
  /** 差し替え後の本文要素 (null なら WAAPI は流さず text だけ確定)。 */
  readonly el: HTMLElement | null
  /** 着地させる最終テキスト (訳文 or 原文)。 */
  readonly finalText: string
  /** 表示テキストを更新する (React setState)。 */
  readonly setText: (text: string) => void
  readonly reducedMotion: boolean
}

export type TextTransition = {
  /** translating 中に本文要素へ付ける CSS class (間欠グリッチ)。null = 無し。 */
  readonly loadingClass: string | null
  /** 原文退場 (CRT shutdown) で本文要素へ付ける CSS class。null = 無し。 */
  readonly exitClass: string | null
  /** exit アニメの長さ (ms)。controller はこの後にテキストを差し替えて playEntry を呼ぶ。 */
  readonly exitMs: number
  /**
   * 差し替え後の要素に boot-up を流し、entry 窓の間に一部の文字を軽くスクランブル
   * してから finalText に着地させる。reduced-motion / el=null は即 setText(final)。
   * 返り値は cancel (= Lightbox を閉じた等で進行中の entry を止める)。
   */
  playEntry(args: PlayEntryArgs): () => void
}

/**
 * テーマ key → テキスト遷移記述子。未対応テーマは default (glitch-crt)。
 * 将来テーマは case 追加 (例: wave = CSS crossfade)。
 */
export function getTextTransition(theme: string): TextTransition {
  switch (theme) {
    case 'ink-underline':
      return createInkUnderlineTransition()
    case 'quiet':
      return createQuietTransition()
    case 'glitch-crt':
    case 'default':
    default:
      return createGlitchCrtTransition()
  }
}
