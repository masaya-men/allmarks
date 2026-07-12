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
import { isUniformImage } from './uniform-image'

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
  /** 撮影 canvas の倍率。スマホは `mobileCaptureScale(画面幅)` を渡す。省略時は 1。 */
  readonly scale?: number
  /** 失敗時に scale を落として順に再挑戦する列（例 [1]）。省略時は再挑戦なし
   *  （＝デスクトップは従来どおり 1 回だけ）。 */
  readonly fallbackScales?: readonly number[]
  /** 再挑戦 1 回あたりのタイムアウト (ms, 既定 12000)。初回は timeoutMs が効く。 */
  readonly fallbackTimeoutMs?: number
  /** true なら「ほぼ一様色」の出力を失敗として扱い、次の再挑戦に回す
   *  （iOS Safari の foreignObject 空振り＝真っ白画像の検出）。 */
  readonly rejectUniform?: boolean
  /** 撮影時にカード画像を縮小サムネへ差し替える写像 (原寸 src → 縮小 data-URL)。
   *  多枚数での dom-to-image メモリ枯渇クラッシュを避けるため (N-56)。写像に無い src は
   *  従来どおり原寸 proxy にフォールバックする。省略時＝デスクトップは全て原寸 proxy。 */
  readonly captureThumbnails?: ReadonlyMap<string, string>
}

/** 撮影がどの段で死んだか。null は成功。 */
export type CaptureFailureStage =
  | 'no-frame' // 撮影対象 DOM が無かった（呼び出し側が付与する）
  | 'timeout' // renderShareImage が制限時間内に終わらなかった
  | 'render' // dom-to-image が null / 例外
  | 'decode' // 撮った data-URL を Image に読めなかった
  | 'blank' // 出力がほぼ一様色（真っ白疑い）
  | 'normalize' // 1200×630 正規化が失敗（canvas 不可・汚染など）

export type CaptureAttempt = {
  readonly scale: number
  readonly timeoutMs: number
  readonly elapsedMs: number
  readonly stage: CaptureFailureStage | null
  readonly message: string | null
}

export type CaptureOutcome = {
  readonly dataUrl: string | null
  readonly attempts: readonly CaptureAttempt[]
}

type TimedResult<T> = { readonly value: T | null; readonly timedOut: boolean }

/** `p` が `ms` 以内に解決しなければ timedOut=true を返す (元の promise は放置)。 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<TimedResult<T>> {
  return new Promise((resolve): void => {
    let settled = false
    const timer = setTimeout((): void => {
      if (!settled) {
        settled = true
        resolve({ value: null, timedOut: true })
      }
    }, ms)
    void p.then(
      (v): void => {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          resolve({ value: v, timedOut: false })
        }
      },
      (): void => {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          resolve({ value: null, timedOut: false })
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

/** 1 回分の撮影 (指定 scale・timeout) を試み、診断付きで結果を返す。 */
async function attemptCapture(
  node: HTMLElement,
  opts: CaptureCollageOpts,
  scale: number | undefined,
  timeoutMs: number,
): Promise<{ readonly dataUrl: string | null; readonly attempt: CaptureAttempt }> {
  const started = Date.now()
  const finalW = opts.width ?? 1200
  const finalH = opts.height ?? 630
  // コラージュの見た目どおりの縦横比で撮ってから 1200×630 に cover 正規化する。
  // node の実寸 (offsetWidth/Height) を使い、取れなければ最終寸法にフォールバック。
  const captureW = node.offsetWidth || finalW
  const captureH = node.offsetHeight || finalH
  let renderMessage: string | null = null

  const fail = (stage: CaptureFailureStage): { readonly dataUrl: null; readonly attempt: CaptureAttempt } => ({
    dataUrl: null,
    attempt: { scale: scale ?? 1, timeoutMs, elapsedMs: Date.now() - started, stage, message: renderMessage },
  })

  // 撮影は高品質・サイズ制限ほぼ無しで 1 回だけ (最終サイズ調整は正規化側が担う)。
  const rendered = await withTimeout(
    renderShareImage(node, {
      width: captureW,
      height: captureH,
      targetBytes: 8 * 1024 * 1024,
      startQuality: 0.94,
      minQuality: 0.94,
      bgColor: opts.boardColor,
      rewriteImageSrc: (src): string => opts.captureThumbnails?.get(src) ?? rewriteToProxy(src, opts.origin),
      onError: (m): void => {
        renderMessage = m
      },
      ...(typeof scale === 'number' ? { scale } : {}),
    }),
    timeoutMs,
  )
  if (rendered.timedOut) return fail('timeout')
  if (!rendered.value) return fail('render')

  const img = await loadImage(rendered.value)
  if (!img) return fail('decode')
  if (opts.rejectUniform && isUniformImage(img)) return fail('blank')

  // normalizeShotToJpegDataUrl は原則 null を返して失敗を伝えるが、想定外の入力
  // (テスト環境の Image スタブ等) では内部の URL.createObjectURL が例外を投げる
  // ことがある。「共有を絶対に壊さない」という本モジュールの前提を守るため、
  // ここでも捕捉して 'normalize' 段の失敗として記録する。
  let normalized: string | null
  try {
    normalized = await normalizeShotToJpegDataUrl(img, {
      width: finalW,
      height: finalH,
      targetBytes: opts.targetBytes ?? 180 * 1024,
      fit: opts.fit ?? 'cover',
      bgColor: opts.boardColor,
    })
  } catch (e) {
    renderMessage = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    normalized = null
  }
  if (!normalized) return fail('normalize')

  return {
    dataUrl: normalized,
    attempt: { scale: scale ?? 1, timeoutMs, elapsedMs: Date.now() - started, stage: null, message: null },
  }
}

/**
 * 診断付き撮影。初回は opts.scale / opts.timeoutMs で撮り、失敗したら
 * fallbackScales の倍率で順に撮り直す。全試行の記録を attempts に返す。
 */
export async function captureCollageShareImageDetailed(
  node: HTMLElement,
  opts: CaptureCollageOpts,
): Promise<CaptureOutcome> {
  const attempts: CaptureAttempt[] = []
  const first = await attemptCapture(node, opts, opts.scale, opts.timeoutMs ?? 20000)
  attempts.push(first.attempt)
  if (first.dataUrl) return { dataUrl: first.dataUrl, attempts }

  for (const s of opts.fallbackScales ?? []) {
    const retry = await attemptCapture(node, opts, s, opts.fallbackTimeoutMs ?? 12000)
    attempts.push(retry.attempt)
    if (retry.dataUrl) return { dataUrl: retry.dataUrl, attempts }
  }
  return { dataUrl: null, attempts }
}

/**
 * コラージュ DOM ノードを撮影し、1200×630 の JPEG data-URL を返す。撮影不可
 * (canvas 非対応 / dom-to-image 失敗 / 汚染) の場合は null を返し、呼び出し側で
 * thumb 無し共有にフォールバックする (= 共有を絶対に壊さない)。
 *
 * 従来 API（デスクトップ用・挙動不変）: Detailed の dataUrl だけ返す薄いラッパ。
 * fallbackScales を渡さない限り試行は 1 回だけなので、デスクトップの挙動は
 * captureCollageShareImageDetailed 導入前と完全に同一 (byte-identical)。
 */
export async function captureCollageShareImage(
  node: HTMLElement,
  opts: CaptureCollageOpts,
): Promise<string | null> {
  return (await captureCollageShareImageDetailed(node, opts)).dataUrl
}

/** 実機診断用の 1 行文字列。例: "#1 x3.08 timeout 20003ms / #2 x1 render 3120ms SecurityError: …" */
export function formatCaptureAttempts(attempts: readonly CaptureAttempt[]): string {
  return attempts
    .map((a, i) => {
      const head = `#${i + 1} x${Number(a.scale.toFixed(2))} ${a.stage ?? 'ok'} ${a.elapsedMs}ms`
      return a.message ? `${head} ${a.message}` : head
    })
    .join(' / ')
}
