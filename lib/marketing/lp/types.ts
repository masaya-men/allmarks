/** カードの絵の種類(見本 ART のキー)。 */
export type ArtKind =
  | 'halftone' | 'halftone3' | 'film' | 'dither' | 'truchet' | 'swiss'
  | 'ticker' | 'arches' | 'grid' | 'rules' | 'bars' | 'vinyl' | 'tag'

/** ツイート風カードの文(landing.demo.tweet1..3)。 */
export type TweetIndex = 1 | 2 | 3

/** ボード見本のカード1枚。art か tweet のどちらか。a = 幅/高さ。accent = 1 緑 / 2 橙 / 3 青。 */
export type CardSpec = {
  readonly art?: ArtKind
  readonly tweet?: TweetIndex
  readonly a: number
  readonly accent?: 1 | 2 | 3
}

export type Pt = { x: number; y: number }
