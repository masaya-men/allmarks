// URL ハッシュベースの placeholder 画像選択。 thumbnail 無し / 取得失敗の
// カードに「抽象的な背景画像 + 中央タイトル」 を見せるための lib。
//
// 設計:
//   - 同じ URL は常に同じ placeholder を返す (= 決定論的、 セッション跨ぎ安定)
//   - 4 slot 中 N 枚しか実存しなくても hash %= N で割り切る
//   - public/placeholders/ に配置した画像を /placeholders/<filename> で配信
//   - 画像 0 枚なら null を返す = 呼び出し側は従来の text-only 表示に fallback
//
// 今 ship 時点で slot 数 = 1 (barcode.svg のみ)、 user の AI 画像追加で 2〜4 に
// 増える。 lib 側は count に依存しない。

/** 実存する placeholder 画像のパス一覧。 user が AI 画像追加したら append。 */
const PLACEHOLDER_PATHS: ReadonlyArray<string> = [
  '/placeholders/barcode.svg',
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

/** URL から決定論的に 1 つの placeholder を返す。 placeholder が 1 枚も
 *  登録されてない時は null (= 呼び出し側が text-only fallback に戻れる)。 */
export function pickPlaceholderImage(url: string): string | null {
  if (PLACEHOLDER_PATHS.length === 0) return null
  const idx = hashString(url) % PLACEHOLDER_PATHS.length
  return PLACEHOLDER_PATHS[idx] ?? null
}

/** Test 用 / debug 用: 現在登録されてる枚数。 */
export function placeholderCount(): number {
  return PLACEHOLDER_PATHS.length
}
