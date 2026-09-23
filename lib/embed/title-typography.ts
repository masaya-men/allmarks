import type { TitleTypographyResult } from './types'

type Input = {
  readonly title: string
  readonly cardWidth: number
  readonly cardHeight: number
}

/**
 * Pick typography for a TextCard title.
 *
 * Session 55 統一化: 文字数による 3 モード分岐 (headline / editorial / index)
 * を廃止し、 全 TextCard で同じ font-size + 同じ aspect を使う。 user 仕様
 * (= moodboard 上の文字のみツイートを見た目で揃える) に沿った確定値。
 *
 * s219: user 判断で従来の半分のサイズに変更(「とりあえず半分にしていい」)。
 * サクッと読める密度を優先し、テキストカード全種(ツイート含め統一)に適用。
 * 直後のフィードバックで半分(8px)は小さすぎたため8.8pxに再調整、さらに
 * もう一段階「少しだけ」大きくとの要望で10pxに調整。
 *
 * 入力は signature 互換性のために受け取るが内部では使わない。
 */
export function pickTitleTypography(_input: Input): TitleTypographyResult {
  return {
    mode: 'editorial',
    fontSize: 10,
    lineHeight: 15, // 10 × 1.5
    maxLines: 999,  // 実質無制限、 オーバーフローはスクロールで処理
  }
}
