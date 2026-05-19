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
 * 入力は signature 互換性のために受け取るが内部では使わない。
 */
export function pickTitleTypography(_input: Input): TitleTypographyResult {
  return {
    mode: 'editorial',
    fontSize: 16,
    lineHeight: 24, // 16 × 1.5
    maxLines: 999,  // 実質無制限、 オーバーフローはスクロールで処理
  }
}
