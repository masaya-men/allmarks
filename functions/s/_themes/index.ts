// functions/s/_themes/index.ts
// 404 のテーマレジストリ。 共有データが消えた時に体験を絞る代わりに、
// AllMarks の表現の幅を出すため毎回ランダムにテーマを選ぶ。
// 今は wave 1 つだけ、 将来テーマが増えたらここに足すだけで自動的に 404 にも反映される。
import type { Theme404Variant } from '../_template'
import { wave404 } from './wave404'

export const allThemes: ReadonlyArray<Theme404Variant> = [wave404]

/**
 * テーマレジストリから 1 つ選ぶ。 ランダム性は `random` 引数経由なのでテスト時に
 * 決定的に振る舞わせられる。 デフォルトは Math.random。
 */
export function pickTheme(random: () => number = Math.random): Theme404Variant {
  const r = Math.min(Math.max(random(), 0), 0.9999999)
  const idx = Math.floor(r * allThemes.length)
  return allThemes[idx] ?? allThemes[0]
}
