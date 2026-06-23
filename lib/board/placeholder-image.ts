// URL ハッシュベースの placeholder 画像選択。 thumbnail 無し / 取得失敗の
// カードに「抽象的な背景画像 + 中央タイトル」 を見せるための lib。
//
// 設計:
//   - 同じ URL は常に同じ placeholder を返す (= 決定論的、 セッション跨ぎ安定)
//   - public/placeholders/art/<palette>/ に配置した SVG を
//     /placeholders/art/<palette>/<style>.svg で配信
//   - 画像 0 枚なら null を返す = 呼び出し側は従来の text-only 表示に fallback
//
// 背景アートはブランド準拠のコード生成 SVG (= scripts/generate-placeholder-art.mjs
// が出力。黒 + 控えめな緑 + 音波モチーフの 6 スタイル: waveform / aurora /
// oscillo / grain / ripple / dots)。旧 4 枚 AI 生成 webp (session 87 発注) を置換。
//   - SVG = ベクターなので Lightbox 全画面拡大でも潰れない (旧 webp より高画質)
//   - ファイル URL なので CSS url() / <img src> / canvas Image いずれでも安全
//     (data URI のような符号化・キャッシュ不可の罠がない)
//   - 中央タイトル / 黒スクリム / 角丸は PlaceholderCard 側が描くので、この
//     SVG は「背景アートのみ」(タイトル・枠なし)
//
// テーマ追加時: 別 palette で同スクリプトを再実行し art/<palette>/ を増やす。
// aspect は全カード共通の PLACEHOLDER_ASPECT (1.25) 固定 — 現状どの消費者も
// .aspect を読まない (レイアウト高さは placeholder-aspect.ts が別管理) が、
// 型契約として残す。

export type PlaceholderImage = {
  readonly url: string
  /** width / height. = PLACEHOLDER_ASPECT (1.25). 現状どの消費者も読まない。 */
  readonly aspect: number
}

/** 生成アートのスタイル群 (= 6 SVG ファイル名)。決定論的選択の slot になる。 */
const ART_STYLES = ['waveform', 'aurora', 'oscillo', 'grain', 'ripple', 'dots'] as const

/** 現状はデフォルトテーマのみ。将来テーマ追加でここが palette 引数になる。 */
const ART_PALETTE = 'default'

const PLACEHOLDERS: ReadonlyArray<PlaceholderImage> = ART_STYLES.map((style) => ({
  url: `/placeholders/art/${ART_PALETTE}/${style}.svg`,
  aspect: 1.25,
}))

/** 1 カードが巡回する既定枚数。 user 方針: 作った 6 スタイルを全部使って巡回する
 *  (= カードごとに別順で全 6 枚を周回。 frame[0] は pickPlaceholderImage と一致)。 */
const FRAME_COUNT = ART_STYLES.length

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
 *  登録されてない時は null (= 呼び出し側が text-only fallback に戻れる)。
 *  これは巡回 (placeholderArtFrames) の frame[0] と常に一致する = 静止時や
 *  巡回しない consumer (triage / PiP / 共有) と board の resting frame が揃う。 */
export function pickPlaceholderImage(url: string): PlaceholderImage | null {
  if (PLACEHOLDERS.length === 0) return null
  const idx = hashString(url) % PLACEHOLDERS.length
  return PLACEHOLDERS[idx] ?? null
}

/** 1 カードが「複数画像ツイート式」に巡回する数枚を URL から決定論的に返す。
 *
 *  - frame[0] === pickPlaceholderImage(url).url (= 静止時の絵と一致)
 *  - 残りは別スタイルから重複なく選ぶ (暗い統一トーンなので混在しても浮かない)
 *  - 決定論的 (同 URL → 同じ並び)。巡回は board の画面内 + MOTION 時のみ動かす
 *    (PlaceholderCard 側でゲート)。frameCount < 2 なら静止。 */
export function placeholderArtFrames(
  url: string,
  count: number = FRAME_COUNT,
): readonly string[] {
  const n = PLACEHOLDERS.length
  if (n === 0) return []
  const h = hashString(url)
  const base = h % n

  // 全 index を seed 付き Fisher–Yates で並べ替え、 base を先頭へ固定する。
  const order: number[] = []
  for (let i = 0; i < n; i++) order.push(i)
  let s = h | 0
  for (let i = n - 1; i > 0; i--) {
    s = (Math.imul(s, 1103515245) + 12345) | 0
    const j = Math.abs(s) % (i + 1)
    const a = order[i] as number
    const b = order[j] as number
    order[i] = b
    order[j] = a
  }

  const wanted = Math.min(Math.max(1, count), n)
  const frames: string[] = []
  const pushUrl = (idx: number): void => {
    const ph = PLACEHOLDERS[idx]
    if (ph) frames.push(ph.url)
  }
  pushUrl(base)
  for (const idx of order) {
    if (frames.length >= wanted) break
    if (idx !== base) pushUrl(idx)
  }
  return frames
}

/** Test 用 / debug 用: 現在登録されてる枚数。 */
export function placeholderCount(): number {
  return PLACEHOLDERS.length
}
