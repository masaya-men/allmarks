// ミラー DOM を Canvas API で WebP 画像化する。 ライブラリ依存なし。
//
// 設計: lib/share/snapshot.ts (session 85 の placeholder) の置換。 dom-to-image-more の
// メモリ爆発 + iframe 自動再生問題を回避するため、 DOM walk せず直接 canvas に
// drawImage する方式。 入力は ShareMirror の DOM frame + share data。
//
// jsdom 環境では canvas API が未対応のため、 null を返して safely fail する。
// 実環境 (= ブラウザ) の動作は playwright で検証 (= Task 7)。

import type { ShareDataV2, ShareCardV2 } from './types-v2'

export type MirrorCaptureInput = {
  /** ShareMirror のルート DOM (= 1.91:1 frame)。 null なら null を返す。 */
  readonly mirrorFrame: HTMLElement | null
  /** 共有データ。 cards の URL / thumb / title を読む。 */
  readonly shareData: ShareDataV2
  /** アクティブな tag 名 (= ブランド帯上部表示用、 空配列なら非表示)。 */
  readonly activeTagNames: ReadonlyArray<string>
  /** "N OF M CARDS" の M 側 (= ボード全体のカード数)。 */
  readonly totalBoardCount: number
  /** Output width in px (typical 1200). */
  readonly width: number
  /** Output height in px (typical 628 = 1.91:1)。 */
  readonly height: number
  /** WebP quality 0.0-1.0。 */
  readonly quality: number
}

const BG_COLOR = '#0a0a0c'
const BRAND_GREEN = '#28F100'
const TEXT_MAIN = 'rgba(255, 255, 255, 0.92)'
const TEXT_SOFT = 'rgba(255, 255, 255, 0.42)'

export async function captureMirrorToWebP(input: MirrorCaptureInput): Promise<string | null> {
  if (!input.mirrorFrame) return null

  try {
    const canvas = document.createElement('canvas')
    canvas.width = input.width
    canvas.height = input.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // 背景塗り (= board の地色と揃える)
    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, input.width, input.height)

    // ミラー DOM から card 要素を取得 + 各カードを描画
    await drawCards(ctx, input)

    // ブランド帯
    drawBrandStrip(ctx, input)

    // toBlob 経由で WebP base64 を返す
    const dataUrl: string | null = await canvasToWebP(canvas, input.quality)
    return dataUrl
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('[share/capture-mirror] capture failed', e)
    return null
  }
}

async function drawCards(ctx: CanvasRenderingContext2D, input: MirrorCaptureInput): Promise<void> {
  const frame = input.mirrorFrame
  if (!frame) return
  const frameRect = frame.getBoundingClientRect()
  if (frameRect.width === 0 || frameRect.height === 0) return

  const scaleX = input.width / frameRect.width
  const scaleY = input.height / frameRect.height

  const cardEls = Array.from(frame.querySelectorAll<HTMLElement>('[data-mirror-card-id]'))
  for (const el of cardEls) {
    const rect = el.getBoundingClientRect()
    const cx = (rect.left - frameRect.left) * scaleX
    const cy = (rect.top - frameRect.top) * scaleY
    const cw = rect.width * scaleX
    const ch = rect.height * scaleY

    // OG frame からはみ出ているカードはスキップ
    if (cx + cw < 0 || cy + ch < 0 || cx > input.width || cy > input.height) continue

    const cardId = el.dataset.mirrorCardId ?? ''
    const card = input.shareData.cards.find((c): c is ShareCardV2 => indexedUrl(c) === cardId)
    if (!card) continue

    // カードの背景塗り (= 失敗時の fallback ベース、 cross-origin OK なら drawImage で上書き)
    ctx.fillStyle = '#1a1a1c'
    ctx.fillRect(cx, cy, cw, ch)

    // サムネ画像が取れれば drawImage
    if (card.th) {
      try {
        const img = await loadCrossOriginImage(card.th)
        if (img) ctx.drawImage(img, cx, cy, cw, ch)
      } catch {
        // 失敗時はベース塗りそのまま (= 上の灰色)
      }
    }

    // タイトル text を 1〜2 行 (= card type 別に色分けはしない、 落ち着いた白)
    ctx.fillStyle = TEXT_MAIN
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    const titleSize = Math.max(9, Math.round(ch * 0.09))
    ctx.font = `500 ${titleSize}px "Geist Mono", ui-monospace, monospace`
    drawClippedText(ctx, card.t, cx + 6, cy + ch - titleSize - 6, cw - 12)
  }
}

function drawBrandStrip(ctx: CanvasRenderingContext2D, input: MirrorCaptureInput): void {
  const W = input.width
  const H = input.height
  const padding = 18

  // 上部 tag 帯 (= activeTagNames が空でなければ "MUSIC · DESIGN")
  if (input.activeTagNames.length > 0) {
    const text = input.activeTagNames.map((s): string => s.toUpperCase()).join(' · ')
    ctx.fillStyle = TEXT_SOFT
    ctx.font = '500 13px "Geist Mono", ui-monospace, monospace'
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    drawClippedText(ctx, text, padding, padding, W - padding * 2)
  }

  // 左下 「A」 マーク (= 簡略表現、 32×32 px)
  drawALogo(ctx, padding, H - padding - 32, 32)

  // 右下 「N CARDS · NEWEST FIRST」 or「N OF M CARDS · NEWEST FIRST」
  const N = input.shareData.cards.length
  const M = input.totalBoardCount
  const captionText = M > N
    ? `${N} OF ${M} CARDS · NEWEST FIRST`
    : `${N} CARDS`
  ctx.fillStyle = TEXT_MAIN
  ctx.font = '500 13px "Geist Mono", ui-monospace, monospace'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'right'
  ctx.fillText(captionText, W - padding, H - padding - 16)

  // 右下緑 dot
  ctx.fillStyle = BRAND_GREEN
  ctx.beginPath()
  ctx.arc(W - padding - ctx.measureText(captionText).width - 12, H - padding - 16, 3, 0, Math.PI * 2)
  ctx.fill()
}

function drawALogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.save()
  ctx.translate(x, y)
  // 黒い背景は省略 (= 透明)、 白い A の縦線 + 横線
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.94)'
  ctx.lineWidth = Math.max(2, size * 0.08)
  ctx.lineCap = 'square'
  ctx.beginPath()
  ctx.moveTo(size * 0.18, size * 0.84)
  ctx.lineTo(size * 0.5, size * 0.1)
  ctx.lineTo(size * 0.82, size * 0.84)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(size * 0.33, size * 0.58)
  ctx.lineTo(size * 0.67, size * 0.58)
  ctx.stroke()
  // 緑チェック
  ctx.strokeStyle = BRAND_GREEN
  ctx.lineWidth = Math.max(1.5, size * 0.06)
  ctx.beginPath()
  ctx.moveTo(size * 0.62, size * 0.74)
  ctx.lineTo(size * 0.72, size * 0.84)
  ctx.lineTo(size * 0.9, size * 0.62)
  ctx.stroke()
  ctx.restore()
}

function drawClippedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
): void {
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y)
    return
  }
  // 末尾 ... で切り詰め
  let clipped = text
  while (clipped.length > 1 && ctx.measureText(clipped + '…').width > maxWidth) {
    clipped = clipped.slice(0, -1)
  }
  ctx.fillText(clipped + '…', x, y)
}

function loadCrossOriginImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve): void => {
    if (typeof Image === 'undefined') { resolve(null); return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = (): void => resolve(img)
    img.onerror = (): void => resolve(null)
    img.src = url
  })
}

function canvasToWebP(canvas: HTMLCanvasElement, quality: number): Promise<string | null> {
  return new Promise((resolve): void => {
    if (typeof canvas.toBlob !== 'function') { resolve(null); return }
    canvas.toBlob(
      (blob): void => {
        if (!blob) { resolve(null); return }
        const reader = new FileReader()
        reader.onload = (): void => resolve(typeof reader.result === 'string' ? reader.result : null)
        reader.onerror = (): void => resolve(null)
        reader.readAsDataURL(blob)
      },
      'image/webp',
      quality,
    )
  })
}

/** Card identity for mirror DOM <-> share data linking. URL is unique per card. */
function indexedUrl(card: ShareCardV2): string {
  return card.u
}
