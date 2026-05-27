// URL ハッシュベースの placeholder 画像選択。 thumbnail 無し / 取得失敗の
// カードに「抽象的な背景画像 + 中央タイトル」 を見せるための lib。
//
// 設計:
//   - 同じ URL は常に同じ placeholder を返す (= 決定論的、 セッション跨ぎ安定)
//   - public/placeholders/ に配置した image を /placeholders/<filename> で配信
//   - 各 placeholder は aspect (= width / height) を持つ。 board 拡張時に
//     カードのサイズ感を決めるのに使う (= user 意図で 1:1 と 16:9 が混在し、
//     視覚的な「サイズ感の差」 を board 上に作る)
//   - 画像 0 枚なら null を返す = 呼び出し側は従来の text-only 表示に fallback
//
// 4 枚の AI 生成画像 (= session 87 で user 発注):
//   - dark   : ぼかし fashion editorial、 黒系
//   - light  : 飴細工 / ガラス sculpture stillife、 白系 wide
//   - jewel  : 宝石色 silk + 部分人物、 華やか
//   - fog    : 水面 + 霧 horizon (杉本博司 風)、 シルバー系

export type PlaceholderImage = {
  readonly url: string
  /** width / height. 1.0 = square, > 1 = landscape, < 1 = portrait. */
  readonly aspect: number
}

const PLACEHOLDERS: ReadonlyArray<PlaceholderImage> = [
  { url: '/placeholders/text-card-dark.webp',  aspect: 1.0 },
  { url: '/placeholders/text-card-light.webp', aspect: 1.777 },
  { url: '/placeholders/text-card-jewel.webp', aspect: 1.0 },
  { url: '/placeholders/text-card-fog.webp',   aspect: 1.0 },
] as const

/** 文字列を 32bit 整数にハッシュ (= djb2)。 暗号用途じゃなくて単に「同じ URL は
 *  同じ slot に落ちる」 ためなので速度重視。 */
function hashString(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/** URL から決定論的に 1 枚の placeholder を返す。 placeholder が 1 枚も
 *  登録されてない時は null (= 呼び出し側が text-only fallback に戻れる)。 */
export function pickPlaceholderImage(url: string): PlaceholderImage | null {
  if (PLACEHOLDERS.length === 0) return null
  const idx = hashString(url) % PLACEHOLDERS.length
  return PLACEHOLDERS[idx] ?? null
}

/** Test 用 / debug 用: 現在登録されてる枚数。 */
export function placeholderCount(): number {
  return PLACEHOLDERS.length
}
