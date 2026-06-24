import { createScrambleTransition } from './themes/scramble'

export type TextTransitionHandle = {
  /** 訳文(or 原文)が確定したら呼ぶ。スクランブルがその文字列に着地する。 */
  settle: (finalText: string) => void
  /** 進行中の遷移を中断 (Lightbox を閉じた / カード切替時)。 */
  cancel: () => void
}

export type TextTransitionRunArgs = {
  /** 切替前のテキスト (原文 or 直前の訳文)。 */
  fromText: string
  /** 切替後のテキスト。null = まだ未確定 (DL/翻訳中) → スクランブルをループ。 */
  toText: string | null
  /** tick ごとに「いま表示すべき文字列」を渡す。 */
  onFrame: (text: string) => void
  /** 切替の山場で chromatic-aberration glitch を on/off する。 */
  onGlitch?: (active: boolean) => void
  reducedMotion: boolean
}

export type TextTransition = {
  run: (args: TextTransitionRunArgs) => TextTransitionHandle
}

/** テーマ key → テキスト遷移ストラテジ。未対応 theme は default(scramble+glitch)。
 *  将来テーマは case 追加 (例: wave = CSS crossfade ストラテジ)。
 *  getEntryAnimation (lib/animation/tag-entry) と同じ思想。 */
export function getTextTransition(theme: string): TextTransition {
  switch (theme) {
    case 'scramble':
    case 'default':
    default:
      return createScrambleTransition()
  }
}
