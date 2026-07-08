// lib/share/capture-collage.ts
// SHARE「③作る」の自動撮影: アレンジ中の本物のコラージュ DOM (CollageCanvas の root) を
// dom-to-image でそのまま画像化し、共有 OG 用の 1200×630 JPEG data-URL に正規化する。
//
// s169 が手動スクショに倒した唯一の理由 = クロスオリジン汚染。ここでは撮影時だけ、clone の
// カード <img src> を同一オリジン proxy (/api/img?u=…) 経由に書き換える (render-share-image
// の rewriteImageSrc)。これで「本物の並べた画面」を位置・回転・背景・タイトルごと WYSIWYG で
// 自動撮影できる (= 手動スクショと中身同一、ただ自動)。
//
// 取得不可なカードは、そもそもアレンジ画面の時点で <img> の onError → PlaceholderCard
// (文字カード) に既になっているため、この撮影は文字カードをそのまま写す (= 新規劣化なし)。

import { renderShareImage } from './render-share-image'
import { normalizeShotToJpegDataUrl } from './normalize-shot'
import { rewriteToProxy } from './proxy-image'

export type CaptureCollageOpts = {
  /** location.origin — 別オリジン画像だけを proxy 化するための判定に使う。 */
  readonly origin: string
  /** 盤面の地色。カード間の隙間・上下の余白 (JPEG は透明を持てない) をこの色で塗る。 */
  readonly boardColor: string
  /** 最終 OG 画像の幅 (既定 1200)。 */
  readonly width?: number
  /** 最終 OG 画像の高さ (既定 630 = 1.91:1)。 */
  readonly height?: number
  /** 最終ファイルサイズ目標 (既定 180KB)。 */
  readonly targetBytes?: number
  /** 撮影全体のタイムアウト (ms, 既定 20000)。dom-to-image が病的画像等でハングしても
   *  CREATE ボタンを永久に固めないための安全網。超過時は null を返す。 */
  readonly timeoutMs?: number
  /** 'cover' (既定・切り出し) か 'contain' (枠を切らずレターボックス)。本物のボード枠を
   *  丸ごと写したいときは 'contain'。余白は boardColor で塗る。 */
  readonly fit?: 'cover' | 'contain'
}

/** `p` が `ms` 以内に解決しなければ null を返す (元の promise は放置)。 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve): void => {
    let settled = false
    const timer = setTimeout((): void => {
      if (!settled) {
        settled = true
        resolve(null)
      }
    }, ms)
    void p.then(
      (v): void => {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          resolve(v)
        }
      },
      (): void => {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          resolve(null)
        }
      },
    )
  })
}

/** data-URL を Image に読み込む。Image 非対応環境 (jsdom 等) や失敗時は null。 */
function loadImage(dataUrl: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve): void => {
    if (typeof Image === 'undefined') {
      resolve(null)
      return
    }
    const img = new Image()
    img.onload = (): void => resolve(img)
    img.onerror = (): void => resolve(null)
    img.src = dataUrl
  })
}

/**
 * コラージュ DOM ノードを撮影し、1200×630 の JPEG data-URL を返す。撮影不可
 * (canvas 非対応 / dom-to-image 失敗 / 汚染) の場合は null を返し、呼び出し側で
 * thumb 無し共有にフォールバックする (= 共有を絶対に壊さない)。
 */
export async function captureCollageShareImage(
  node: HTMLElement,
  opts: CaptureCollageOpts,
): Promise<string | null> {
  const finalW = opts.width ?? 1200
  const finalH = opts.height ?? 630
  // コラージュの見た目どおりの縦横比で撮ってから 1200×630 に cover 正規化する。
  // node の実寸 (offsetWidth/Height) を使い、取れなければ最終寸法にフォールバック。
  const captureW = node.offsetWidth || finalW
  const captureH = node.offsetHeight || finalH

  // 撮影は高品質・サイズ制限ほぼ無しで 1 回だけ (最終サイズ調整は正規化側が担う)。
  const captured = await withTimeout(
    renderShareImage(node, {
      width: captureW,
      height: captureH,
      targetBytes: 8 * 1024 * 1024,
      startQuality: 0.94,
      minQuality: 0.94,
      bgColor: opts.boardColor,
      rewriteImageSrc: (src): string => rewriteToProxy(src, opts.origin),
    }),
    opts.timeoutMs ?? 20000,
  )
  if (!captured) return null

  const img = await loadImage(captured)
  if (!img) return null

  return normalizeShotToJpegDataUrl(img, {
    width: finalW,
    height: finalH,
    targetBytes: opts.targetBytes ?? 180 * 1024,
    fit: opts.fit ?? 'cover',
    bgColor: opts.boardColor,
  })
}
