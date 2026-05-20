/**
 * TextCard layout — session 55 統一化以降は全 TextCard が 5:4 横長 (= aspect
 * 1.25)、 maxLines も実質無制限。 文字数による pretext measure + 9:16 clamp 廃止。
 * オーバーフローは TextCard 側の scroll + 底フェードで処理する。
 */
import type { TitleTypographyResult } from './types'

/** TextCard の固定アスペクト比 (= 5:4 横長)。 session 55 で全 TextCard を統一
 *  化したときに 9/16 clamp を廃止して 1.25 固定にした。 */
export const TEXT_CARD_ASPECT = 1.25

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
