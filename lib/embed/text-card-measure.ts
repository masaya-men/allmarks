/**
 * TextCard layout — session 55 統一化以降は全 TextCard が正方形 (= aspect 1.0)、
 * maxLines も実質無制限。 文字数による pretext measure + 9:16 clamp 廃止。
 * オーバーフローは TextCard 側の scroll + 底フェードで処理する。
 */
import type { TitleTypographyResult } from './types'

/**
 * 既存 import 互換のため `TEXT_CARD_MIN_ASPECT` 名は残置。 session 55 から
 * 値は 1.25 (= 5:4 横長) で固定。 名前は「MIN」 だが現在は唯一の値。
 * 改名は別 task (= Lightbox.tsx の 2 箇所 import を同時更新する必要があるため、
 * 本変更の scope 外)。
 */
export const TEXT_CARD_MIN_ASPECT = 1.25

export type TextCardLayout = {
  readonly aspectRatio: number
  readonly maxLines: number
  readonly clamped: boolean
}

/**
 * Resolve the TextCard's display layout. Session 55 統一化以降は固定値。
 * title が空ならば null を返す (= 既存契約維持、 TextCard 側の guard 不要)。
 */
export function measureTextCardLayout(input: {
  readonly title: string
  readonly cardWidth: number
  readonly typography: TitleTypographyResult
}): TextCardLayout | null {
  if (!input.title) return null
  return {
    aspectRatio: 1.25,
    maxLines: 999,
    clamped: false,
  }
}
