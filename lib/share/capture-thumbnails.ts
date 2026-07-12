// lib/share/capture-thumbnails.ts
// N-56 で実機確定: スマホの共有画像づくりが iOS Safari のタブメモリを超えて落ちる
// 主犯は「canvas の大きさ」ではなく「撮影時に全カード画像を原寸で埋め込むこと」。
// 100枚 = 元画像 合計約78メガピクセル → dom-to-image が一枚の巨大 SVG に全部を
// base64 で載せ、それを Image にデコードする瞬間に約310MB を確保して落ちる。
//
// 対策: 撮影の直前にカード画像を「必要十分な小ささ」のサムネへ縮小し、その data-URL
// を dom-to-image に渡す。枚数が多いほど自動的に小さくして合計画素を一定予算に抑える。
// 少数の共有は原寸のまま (縮小の必要がない = 画質を落とさない)。汚染を避けるため縮小は
// 同一オリジン proxy 経由で取得した画像に対して行う (呼び出し側が proxy URL を渡す)。

/**
 * 撮影用サムネの最大辺 (px)。カード枚数が多いほど小さく＝「合計画素 ≒ budgetMP」を
 * 保つ。1200 が上限 (最終 OG が 1200px 幅なのでそれ以上は無駄)、200 が下限。
 * 少数 (max 辺が 1200 に張り付く枚数) では縮小不要 = 呼び出し側がサムネ化を丸ごと省く。
 */
export function captureThumbnailMaxPx(cardCount: number, budgetMP = 12): number {
  if (cardCount <= 1) return 1200
  const px = Math.sqrt((budgetMP * 1_000_000) / cardCount)
  return Math.round(Math.min(1200, Math.max(200, px)))
}

/**
 * 各 src を縮小 data-URL へ写像した Map を作る。`downscale` は 1 枚を縮小して data-URL
 * を返す (失敗時 null)。重複 src は 1 回だけ縮小。個々の失敗はスキップ (その src は Map
 * に入らず、撮影側が原寸 proxy にフォールバックする) ＝全体は決して reject しない。
 * メモリを守るため同時実行数を `concurrency` に制限する (原寸デコードは 1 枚 = 数MB なので
 * 数枚並列なら安全、直列より速い)。
 */
export async function buildCaptureThumbnailMap(
  srcs: readonly string[],
  downscale: (src: string) => Promise<string | null>,
  concurrency = 4,
): Promise<Map<string, string>> {
  const uniq = Array.from(new Set(srcs.filter((s) => s.length > 0)))
  const map = new Map<string, string>()
  let next = 0

  async function worker(): Promise<void> {
    while (next < uniq.length) {
      const src = uniq[next++]
      try {
        const small = await downscale(src)
        if (small) map.set(src, small)
      } catch {
        // この 1 枚は原寸 proxy にフォールバック — 撮影は止めない。
      }
    }
  }

  const lanes = Math.max(1, Math.min(concurrency, uniq.length))
  await Promise.all(Array.from({ length: lanes }, () => worker()))
  return map
}

/**
 * 同一オリジンの (proxy) URL から画像を読み、最大辺 `maxPx` に収まる JPEG data-URL を
 * 返す。canvas 非対応や失敗時は null (撮影側が原寸 proxy にフォールバック)。proxy 経由
 * ＝同一オリジンなので canvas は汚染されず toDataURL が通る。
 */
export function downscaleImageViaCanvas(proxyUrl: string, maxPx: number): Promise<string | null> {
  return new Promise((resolve): void => {
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      resolve(null)
      return
    }
    const img = new Image()
    img.onload = (): void => {
      try {
        const w = img.naturalWidth
        const h = img.naturalHeight
        if (!w || !h) {
          resolve(null)
          return
        }
        const s = Math.min(1, maxPx / Math.max(w, h))
        const cw = Math.max(1, Math.round(w * s))
        const ch = Math.max(1, Math.round(h * s))
        const c = document.createElement('canvas')
        c.width = cw
        c.height = ch
        const ctx = c.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }
        ctx.drawImage(img, 0, 0, cw, ch)
        resolve(c.toDataURL('image/jpeg', 0.82))
      } catch {
        resolve(null)
      }
    }
    img.onerror = (): void => resolve(null)
    img.src = proxyUrl
  })
}
